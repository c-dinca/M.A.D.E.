-- M.A.D.E. initial schema. NORMATIVE.
--
-- Prose: docs/02-architecture/02-data-model.md
-- Decisions: ADR-0003 (Postgres as system of record), ADR-0004 (event log separate from
--            checkpoints), ADR-0013 (single-tenant), ADR-0017 (artifacts in an object store).
--
-- Rules enforced here rather than in application code, because an invariant that needs code to hold
-- is an invariant that stops holding:
--   * run_events is append-only. The application role receives no UPDATE or DELETE grant (INV-1).
--   * State names in the CHECK below MUST equal the state list in contracts/state-machine.json.
--     spec-lint asserts this; a divergence silently disables transitions.
--   * Money is NUMERIC, never floating point. A ledger compared against a ceiling cannot lose cents.
--   * Nothing here stores file contents. Source lives in git, artifacts in the object store.
--
-- The graph framework creates and owns its own checkpoint tables in this database. They are a
-- resumption cache with no audit standing and MUST NOT be read by any audit, export or reporting
-- path (ADR-0004).

CREATE TABLE schema_migrations (
    version     text        PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Projects and their versioned configuration
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
    id              uuid        PRIMARY KEY,
    name            text        NOT NULL UNIQUE,
    repo_url        text        NOT NULL,
    default_branch  text        NOT NULL,
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Immutable per version. A Run records the version it executed under, so changing a budget never
-- rewrites the meaning of a past Run (FR-005, INV-9).
CREATE TABLE project_configs (
    project_id            uuid          NOT NULL REFERENCES projects(id),
    version               integer       NOT NULL,
    sandbox_image_digest  text          NOT NULL,
    baseline_command      jsonb         NOT NULL,
    full_suite_command    jsonb         NOT NULL,
    model_tiers           jsonb         NOT NULL,
    egress_allowlist      jsonb         NOT NULL DEFAULT '[]'::jsonb,
    run_ceiling_usd       numeric(12,6) NOT NULL,
    project_ceiling_usd   numeric(12,6) NOT NULL,
    max_attempts_per_task integer       NOT NULL DEFAULT 3,
    max_attempts_per_run  integer       NOT NULL DEFAULT 12,
    max_tasks             integer       NOT NULL DEFAULT 12,
    run_ttl_s             integer       NOT NULL DEFAULT 1800,
    approval_ttl_s        integer       NOT NULL DEFAULT 604800,
    plan_approval         boolean       NOT NULL DEFAULT true,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, version),
    CONSTRAINT sandbox_image_pinned_by_digest CHECK (sandbox_image_digest LIKE '%@sha256:%'),
    CONSTRAINT positive_ceilings CHECK (run_ceiling_usd > 0 AND project_ceiling_usd > 0),
    CONSTRAINT sane_caps CHECK (max_attempts_per_task > 0 AND max_attempts_per_run >= max_attempts_per_task)
);

-- ---------------------------------------------------------------------------
-- Runs
-- ---------------------------------------------------------------------------

CREATE TABLE runs (
    id                     uuid          PRIMARY KEY,
    project_id             uuid          NOT NULL REFERENCES projects(id),
    project_config_version integer       NOT NULL,
    idempotency_key        text          NOT NULL,
    request_text           text          NOT NULL,
    base_commit            text          NOT NULL,
    branch                 text          NOT NULL,
    head_commit            text,
    ceiling_usd            numeric(12,6) NOT NULL,
    state                  text          NOT NULL,
    await_reason           text,
    resume_to              text,
    terminal_reason        text,
    sandbox_image_digest   text          NOT NULL,
    created_by             text          NOT NULL,
    created_at             timestamptz   NOT NULL DEFAULT now(),
    finished_at            timestamptz,
    FOREIGN KEY (project_id, project_config_version) REFERENCES project_configs(project_id, version),
    CONSTRAINT run_idempotency_unique_per_project UNIQUE (project_id, idempotency_key),
    -- MUST equal the state list in contracts/state-machine.json.
    CONSTRAINT run_state_valid CHECK (state IN (
        'INTAKE','SPEC','PLAN','TASK_SELECT','IMPLEMENT','VERIFY','REVIEW',
        'TASK_DONE','TASK_FAILED','INTEGRATE','AWAIT_HUMAN','DONE','REJECTED','ABORTED'
    )),
    CONSTRAINT await_reason_valid CHECK (await_reason IS NULL OR await_reason IN (
        'plan_approval','delivery_approval','ambiguous_request','task_failed','budget_exhausted',
        'cycle_detected','integration_failed','provider_unavailable','delivery_failed','policy_violation'
    )),
    CONSTRAINT terminal_reason_valid CHECK (terminal_reason IS NULL OR terminal_reason IN (
        'delivered','rejected_invalid_request','rejected_policy','cancelled_by_human',
        'ttl_expired','approval_ttl_expired'
    )),
    -- FR-010: a Run may never target the Project default branch. Enforced again in application code
    -- against the Project row; this catches the direct-write path.
    CONSTRAINT branch_is_run_scoped CHECK (branch LIKE 'made/run-%')
);

CREATE INDEX runs_project_created_idx ON runs (project_id, created_at DESC);
CREATE INDEX runs_active_idx ON runs (state) WHERE state NOT IN ('DONE','REJECTED','ABORTED');

-- Hot row: current State, spend and the execution lease. Kept narrow so the append path stays
-- within NFR-017.
CREATE TABLE run_cursor (
    run_id      uuid          PRIMARY KEY REFERENCES runs(id),
    state       text          NOT NULL,
    seq         bigint        NOT NULL DEFAULT 0,
    spent_usd   numeric(12,6) NOT NULL DEFAULT 0,
    lease_owner text,
    lease_until timestamptz,
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT spent_non_negative CHECK (spent_usd >= 0)
);

CREATE INDEX run_cursor_lease_idx ON run_cursor (lease_until) WHERE lease_owner IS NOT NULL;

-- ---------------------------------------------------------------------------
-- The event log. Append-only. The source of truth (UF-5).
-- ---------------------------------------------------------------------------

CREATE TABLE run_events (
    run_id       uuid          NOT NULL REFERENCES runs(id),
    seq          bigint        NOT NULL,
    occurred_at  timestamptz   NOT NULL DEFAULT now(),
    kind         text          NOT NULL,
    state        text          NOT NULL,
    task_id      uuid,
    attempt_no   integer,
    artifact_sha text,
    cost_usd     numeric(12,6) NOT NULL DEFAULT 0,
    payload      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (run_id, seq),
    CONSTRAINT event_seq_positive CHECK (seq > 0),
    CONSTRAINT event_cost_non_negative CHECK (cost_usd >= 0),
    CONSTRAINT event_kind_valid CHECK (kind IN (
        'run_created','state_entered','artifact_produced','patch_applied','patch_rejected',
        'exec_started','exec_completed','llm_call','verification_completed','review_completed',
        'guard_tripped','budget_denied','egress_decision','sandbox_created','sandbox_destroyed',
        'human_signal','recovery_performed','run_finished'
    ))
);

-- Serves the security reviewer's query: what executed, what was called, where could data go.
CREATE INDEX run_events_audit_idx ON run_events (run_id, kind)
    WHERE kind IN ('exec_completed','llm_call','egress_decision','human_signal');

-- ---------------------------------------------------------------------------
-- Tasks and Attempts
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
    id                   uuid          PRIMARY KEY,
    run_id               uuid          NOT NULL REFERENCES runs(id),
    position             integer       NOT NULL,
    kind                 text          NOT NULL,
    intent               text          NOT NULL,
    -- Written once at plan acceptance and never updated (FR-034). There is no UPDATE path in
    -- application code; a change to success criteria after the fact would defeat UF-3.
    verification_command jsonb         NOT NULL,
    depends_on           uuid[]        NOT NULL DEFAULT '{}',
    ceiling_usd          numeric(12,6) NOT NULL,
    max_attempts         integer       NOT NULL,
    status               text          NOT NULL DEFAULT 'PENDING',
    created_at           timestamptz   NOT NULL DEFAULT now(),
    finished_at          timestamptz,
    CONSTRAINT task_kind_valid CHECK (kind IN ('code','test','iac','docs')),
    CONSTRAINT task_status_valid CHECK (status IN ('PENDING','RUNNING','DONE','FAILED')),
    CONSTRAINT task_position_unique UNIQUE (run_id, position),
    -- GUARD_PLAN_VALID enforces this earlier; the constraint makes an unverifiable Task
    -- unrepresentable even via a direct write (FR-024).
    CONSTRAINT verification_command_non_empty CHECK (jsonb_array_length(verification_command) > 0)
);

CREATE INDEX tasks_run_position_idx ON tasks (run_id, position);

CREATE TABLE attempts (
    id                     uuid        PRIMARY KEY,
    task_id                uuid        NOT NULL REFERENCES tasks(id),
    attempt_no             integer     NOT NULL,
    patch_sha              text,
    patch_hash             text,
    compiles               boolean,
    verification_exit_code integer,
    failing_count          integer,
    failure_signature      text,
    output_sha             text,
    outcome                text        NOT NULL,
    started_at             timestamptz NOT NULL DEFAULT now(),
    finished_at            timestamptz,
    CONSTRAINT attempt_no_positive CHECK (attempt_no > 0),
    CONSTRAINT attempt_unique UNIQUE (task_id, attempt_no),
    CONSTRAINT attempt_outcome_valid CHECK (outcome IN (
        'patch_rejected','lint_failed','verification_failed','verified','not_verified'
    ))
);

CREATE INDEX attempts_signature_idx ON attempts (task_id, failure_signature);

-- ---------------------------------------------------------------------------
-- Artifacts (metadata only; bytes live in the object store — ADR-0017)
-- ---------------------------------------------------------------------------

CREATE TABLE artifacts (
    sha256         text        PRIMARY KEY,
    kind           text        NOT NULL,
    schema_version text        NOT NULL,
    size_bytes     bigint      NOT NULL,
    storage_key    text        NOT NULL,
    run_id         uuid        REFERENCES runs(id),
    task_id        uuid        REFERENCES tasks(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT artifact_sha_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT artifact_kind_valid CHECK (kind IN (
        'spec','task_graph','patch','test_report','review_report','attempt_record',
        'run_summary','raw_log','prompt'
    ))
);

-- ---------------------------------------------------------------------------
-- Cost ledger
-- ---------------------------------------------------------------------------

CREATE TABLE llm_calls (
    id              uuid          PRIMARY KEY,
    run_id          uuid          NOT NULL REFERENCES runs(id),
    task_id         uuid          REFERENCES tasks(id),
    attempt_no      integer,
    state           text          NOT NULL,
    tier            text          NOT NULL,
    provider        text          NOT NULL,
    model           text          NOT NULL,
    prompt_version  text          NOT NULL,
    used_fallback   boolean       NOT NULL DEFAULT false,
    tokens_in       integer       NOT NULL DEFAULT 0,
    tokens_cached   integer       NOT NULL DEFAULT 0,
    tokens_out      integer       NOT NULL DEFAULT 0,
    cost_usd        numeric(12,6) NOT NULL DEFAULT 0,
    usage_estimated boolean       NOT NULL DEFAULT false,
    latency_ms      integer,
    status          text          NOT NULL,
    idempotency_key text          NOT NULL UNIQUE,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT tier_valid CHECK (tier IN ('PLAN','EDIT','NAV','CRITIC')),
    CONSTRAINT llm_call_status_valid CHECK (status IN ('pending','completed','failed','unconfirmed')),
    CONSTRAINT llm_cost_non_negative CHECK (cost_usd >= 0)
);

CREATE INDEX llm_calls_run_idx ON llm_calls (run_id);

-- ---------------------------------------------------------------------------
-- Sandbox lifecycle and executions — the table a security reviewer reads
-- ---------------------------------------------------------------------------

CREATE TABLE sandbox_sessions (
    id           uuid        PRIMARY KEY,
    run_id       uuid        NOT NULL REFERENCES runs(id),
    runtime      text        NOT NULL,
    image_digest text        NOT NULL,
    limits       jsonb       NOT NULL,
    network      text        NOT NULL DEFAULT 'none',
    created_at   timestamptz NOT NULL DEFAULT now(),
    destroyed_at timestamptz,
    destroy_reason text,
    CONSTRAINT sandbox_network_valid CHECK (network IN ('none','allowlist'))
);

CREATE INDEX sandbox_sessions_open_idx ON sandbox_sessions (run_id) WHERE destroyed_at IS NULL;

CREATE TABLE sandbox_execs (
    id          uuid        PRIMARY KEY,
    session_id  uuid        NOT NULL REFERENCES sandbox_sessions(id),
    run_id      uuid        NOT NULL REFERENCES runs(id),
    task_id     uuid        REFERENCES tasks(id),
    attempt_no  integer,
    argv        jsonb       NOT NULL,
    cwd         text        NOT NULL,
    exit_code   integer,
    duration_ms integer,
    timed_out   boolean     NOT NULL DEFAULT false,
    output_sha  text,
    started_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT argv_is_array CHECK (jsonb_typeof(argv) = 'array')
);

CREATE INDEX sandbox_execs_session_idx ON sandbox_execs (session_id, started_at);

CREATE TABLE egress_events (
    id          uuid        PRIMARY KEY,
    run_id      uuid        NOT NULL REFERENCES runs(id),
    session_id  uuid        REFERENCES sandbox_sessions(id),
    destination text        NOT NULL,
    allowed     boolean     NOT NULL,
    reason      text        NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX egress_events_run_idx ON egress_events (run_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Human decisions
-- ---------------------------------------------------------------------------

CREATE TABLE approvals (
    id              uuid        PRIMARY KEY,
    run_id          uuid        NOT NULL REFERENCES runs(id),
    awaiting_state  text        NOT NULL,
    await_reason    text        NOT NULL,
    decision        text        NOT NULL,
    actor           text        NOT NULL,
    reason_text     text,
    -- What the actor was shown. An approval of something nobody saw is not an approval.
    shown_artifacts text[]      NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT approval_decision_valid CHECK (decision IN ('approve','revise','amend_plan','cancel')),
    CONSTRAINT approval_idempotent UNIQUE (run_id, awaiting_state, decision)
);

CREATE TABLE api_keys (
    id          uuid        PRIMARY KEY,
    label       text        NOT NULL UNIQUE,
    key_hash    text        NOT NULL UNIQUE,
    role        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    revoked_at  timestamptz,
    CONSTRAINT api_key_role_valid CHECK (role IN ('operator','submitter','auditor'))
);
