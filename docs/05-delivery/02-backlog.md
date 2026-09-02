# Backlog — the work queue

This is the queue. Take the highest item whose dependencies are met and whose **Touches** do not
overlap anything in flight ([04-engineering/05-git-and-review-workflow.md](../04-engineering/05-git-and-review-workflow.md)).

**Reading** is exhaustive, not indicative. Read those documents and no others; context spent elsewhere
is context unavailable for the work. **Touches** is a contract with the other agents: if the work
requires a path outside it, stop and report rather than widening.

Contract changes land alone and first. Items marked **contract-only** modify
[`/contracts/`](../../contracts/) and nothing else; their consumers are separate items.

Roles map to directories and are defined in [`/AGENTS.md`](../../AGENTS.md).

> **Read this before taking any item added by the 2026-09 vision change.** Every entity that change
> introduced — lane, worksite, request, finding, evidence record, tenant, user, entitlement, approval
> policy, ingress event, work queue, claim, git operation — is **absent from
> [`/contracts/`](../../contracts/)**, which is normative. The prose describing them is ahead of the
> contract, and under the source-of-truth hierarchy that makes the prose the thing without a normative
> form ([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)).
>
> **`CON-01` to `CON-06` below are therefore hard blockers**, not paperwork. No implementation item for
> a new entity is startable until the contract item it depends on has merged. If an item's Reading list
> points at a document describing an entity whose contract has not landed, **the item is not ready —
> stop and report** per [`/AGENTS.md`](../../AGENTS.md).
>
> This ordering is not bureaucracy: it is what lets several agents implement consumers of the same
> interface concurrently ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).

---

## M0 — Foundations and contracts

### CON-01 — Tenancy, identity and entitlements in the contracts
**Role:** spec · **Blocked by:** — · **Blocks:** PLAT-04, TEN-01, and every item touching a tenant-scoped table · **contract-only**
**Reading:** [02-architecture/18-deployment-and-tenancy.md](../02-architecture/18-deployment-and-tenancy.md), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (Epic Q)
**Touches:** `contracts/db/0001_init.sql`, `contracts/openapi.yaml`, `contracts/schemas/common.schema.json`, `tests/contract/**`
**Acceptance criteria**
- `tenant_id NOT NULL` on every tenant-scoped table, present in **every** unique constraint and in every index serving a tenant-scoped query; row-level security enabled per table (FR-140).
- `tenants`, `users`, `teams`, `team_members`, `principals`, `entitlements`, `approval_policies` defined, with a `CHECK` rejecting an approval policy that names no principal (FR-135, FR-145).
- No nullable tenant column exists anywhere, asserted by a test over the parsed DDL.
- Tenant is absent from every API path and request body; the OpenAPI document has no tenant parameter (FR-141).
- Hostile-insert probes: a row without a tenant, a unique key colliding across tenants, and a policy leaving a scope unapprovable are all rejected by the live schema.

### CON-02 — Lanes, findings and evidence in the contracts
**Role:** spec · **Blocked by:** CON-01 · **Blocks:** ADV-01, ADV-02, WORK-01 · **contract-only**
**Reading:** [01-product/06-lanes.md](../01-product/06-lanes.md), [03-adr/0022-two-lanes-verified-and-advisory.md](../03-adr/0022-two-lanes-verified-and-advisory.md), [03-adr/0023-advisory-findings-carry-evidence.md](../03-adr/0023-advisory-findings-carry-evidence.md)
**Touches:** `contracts/db/0001_init.sql`, `contracts/state-machine.json`, `contracts/schemas/artifact-finding.schema.json`, `contracts/schemas/run-event.schema.json`, `tests/contract/**`
**Acceptance criteria**
- `lane` is a closed enumeration of exactly `verified` and `advisory`, on the work class and recorded on the Run; it is immutable per class (FR-147).
- `findings` and `evidence` are **separate tables**; `evidence_state` is a two-valued `CHECK` and `demonstrated` requires a non-null `evidence_id` foreign key (INV-11, FR-088).
- `evidence_recorded` is a **distinct event kind** from `verification_completed`, and a test asserts no evidence row can be referenced by a verification event (INV-12).
- No `confidence` or score column exists on `findings`, and a test asserts it.
- `ASSESS` and `ASSESS_DONE` states exist with their tool authority declared, including that the write and execute grants are scoped to the evidence workspace (FR-091).
- The state machine remains well-formed: no self-loop, no transition out of a terminal State, and **no edge from the advisory sub-graph into `IMPLEMENT`**.

### CON-03 — Worksites, cycles and claims in the contracts
**Role:** spec · **Blocked by:** CON-01 · **Blocks:** WS-01 to WS-04 · **contract-only**
**Reading:** [01-product/07-worksites.md](../01-product/07-worksites.md), [03-adr/0024-worksites-as-long-running-campaigns.md](../03-adr/0024-worksites-as-long-running-campaigns.md)
**Touches:** `contracts/db/0001_init.sql`, `contracts/openapi.yaml`, `contracts/worksite-state-machine.json`, `contracts/schemas/**`, `tests/contract/**`
**Acceptance criteria**
- `worksites`, `worksite_configs`, `worksite_events`, `worksite_cycles`, `claims` defined; the worksite event log has a dense per-worksite sequence with no update or delete grant (FR-101).
- All four ceilings are `NOT NULL` on the configuration version, and configuration is immutable per version (FR-097, FR-104).
- The worksite lifecycle is a well-formed machine: `PAUSED` has no transition to `ACTIVE` that is not a recorded human decision (FR-103).
- `progress_command` is an argv array, never a string, matching the `exec` rule.
- Hostile-insert probes: a worksite with a null ceiling, a second overlapping active claim, and a duplicate cycle number are all rejected (INV-14, INV-15).

### CON-04 — Requests and the chat front door in the contracts
**Role:** spec · **Blocked by:** CON-01 · **Blocks:** CHAT-01 to CHAT-03 · **contract-only**
**Reading:** [01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md), [03-adr/0025-chat-front-door-request-broker.md](../03-adr/0025-chat-front-door-request-broker.md)
**Touches:** `contracts/db/0001_init.sql`, `contracts/openapi.yaml`, `contracts/request-state-machine.json`, `tests/contract/**`
**Acceptance criteria**
- `requests` and `request_events` defined, with the request lifecycle as a well-formed machine whose only loop — `CLARIFYING → TRIAGED` — carries a bounded counter column (FR-109).
- `decline_reason` is a **closed enumeration** including `requires_generated_plan`, indexed for aggregation, because its distribution is the measurement that answers OQ-19.
- A request cannot reference a work class outside the requester's entitlement, enforced by constraint where expressible and by a documented rule where not.
- The chat posting allowlist is expressed as a schema for the posted payload, so it is assertable rather than described (FR-114).

### CON-05 — Ingress, the work queue and git operations in the contracts
**Role:** spec · **Blocked by:** CON-01 · **Blocks:** RES-01 to RES-03, GIT-03 · **contract-only**
**Reading:** [02-architecture/17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md), [02-architecture/19-repository-access.md](../02-architecture/19-repository-access.md)
**Touches:** `contracts/db/0001_init.sql`, `contracts/openapi.yaml`, `contracts/schemas/run-event.schema.json`, `tests/contract/**`
**Acceptance criteria**
- `ingress_events` with a unique constraint on `(source, provider_delivery_id)`, so a redelivery fails at insert rather than in application logic (FR-116, INV-16).
- `work_queue` with `NOT NULL` position, reason and cause, and a bound per queue expressed as a constraint or a configured maximum (FR-117, INV-17).
- `schedules` with the last fired window recorded, so a miss is a skip rather than a backfill (FR-118).
- `git_operations` recording operation, ref, identity and outcome (FR-128).
- Event kinds added for `ingress_received`, `queued`, `dequeued`, `shed`, `schedule_skipped`, `git_operation`, `access_denied`, `chat_posted`, `admin_action` — all **additive**, with no existing kind changing meaning.

### CON-06 — Console and effectiveness surfaces in the contracts
**Role:** spec · **Blocked by:** CON-01, CON-02, CON-03, CON-04, CON-05 · **Blocks:** CONS-01 to CONS-03 · **contract-only**
**Reading:** [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), [03-adr/0028-web-console-as-a-product-surface.md](../03-adr/0028-web-console-as-a-product-surface.md)
**Touches:** `contracts/openapi.yaml`, `tests/contract/**`
**Acceptance criteria**
- Endpoints for worksites, requests, findings, the queue, effectiveness, entitlements, approval policies, users and teams, conforming to the existing conventions and cursor pagination.
- The effectiveness response carries, for every measure, the **count it was computed from** and an explicit window; a measure with too few observations has a distinct representation rather than a zero (FR-139, FR-132).
- New error codes defined, with `repository_access_revoked` and `repository_access_insufficient` as **422 rather than 503**, because a permission error must not look retryable.
- No endpoint exists that the console needs and the API does not; a test asserts the console's route set is a subset (FR-137).

### PLAT-01 — Project scaffold, tooling and CI skeleton
**Role:** platform · **Blocked by:** — · **Blocks:** everything
**Reading:** [04-engineering/01-repo-structure.md](../04-engineering/01-repo-structure.md), [04-engineering/03-coding-standards.md](../04-engineering/03-coding-standards.md), [04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md)
**Touches:** `pyproject.toml`, `uv.lock`, `.pre-commit-config.yaml`, `Makefile`, `.github/workflows/ci.yml`, `made/__init__.py`, `tests/conftest.py`
**Acceptance criteria**
- `make fmt`, `make lint`, `make types`, `make test` all run and pass on an empty test suite.
- `mypy --strict` is configured over `made/` with no per-module opt-outs.
- Pre-commit runs formatter, linter and a secret scan.
- CI stages 1–3 and 5 from [04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md) run on a pull request.
- The import-boundary lint rule exists and fails on a deliberate violation fixture.

### PLAT-02 — Configuration, validation and the redaction registry
**Role:** platform · **Blocked by:** PLAT-01 · **Blocks:** PLAT-05, LLM-01, SBX-02
**Reading:** [02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-046, FR-066)
**Touches:** `made/config/**`, `deploy/config.example.yaml`, `tests/unit/test_config.py`, `tests/unit/test_redaction.py`
**Acceptance criteria**
- Startup fails with a message naming the missing tier when any capability tier is unconfigured (FR-046).
- No built-in default model endpoint exists anywhere in the tree.
- Secrets are registered with the redactor at startup; a corpus of at least 20 credential formats is scrubbed from log, event, artifact and prompt paths (NFR-008).
- Invalid configuration fails at startup, not on first use.

### PLAT-03 — Artifact models mirroring the contracts
**Role:** platform · **Blocked by:** PLAT-01 · **Blocks:** ORCH-01, AGENT-01
**Reading:** [`/contracts/README.md`](../../contracts/README.md), [`/contracts/schemas/`](../../contracts/schemas/), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md)
**Touches:** `made/artifacts/schemas.py`, `tests/contract/test_artifact_schemas.py`
**Acceptance criteria**
- One Pydantic model per artifact schema, each carrying `schema_version`.
- A contract test round-trips every schema example and asserts the generated JSON Schema is compatible with the published one.
- Validation failure raises a typed error, never a bare `ValidationError` at a module boundary.

### PLAT-04 — Database schema and migration runner
**Role:** platform · **Blocked by:** PLAT-01 · **Blocks:** PLAT-05, PLAT-06
**Reading:** [`/contracts/db/0001_init.sql`](../../contracts/db/0001_init.sql), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md), [04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md) (migration safety)
**Touches:** `migrations/**`, `made/store/migrations.py`, `tests/integration/test_migrations.py`
**Acceptance criteria**
- `make migrate` applies migrations forward-only and is idempotent.
- The application role has no UPDATE or DELETE grant on `run_events` (INV-1).
- State names in the `CHECK` constraint match [`/contracts/state-machine.json`](../../contracts/state-machine.json) exactly, asserted by a test.
- A migration applied to a database seeded at the previous release leaves the previous release's suite passing.

### PLAT-05 — Event append, fold and run lease
**Role:** platform · **Blocked by:** PLAT-02, PLAT-04 · **Blocks:** ORCH-03, AUDIT-02
**Reading:** [02-architecture/09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-016, NFR-017)
**Touches:** `made/store/events.py`, `made/store/lease.py`, `made/audit/fold.py`, `tests/replay/test_fold.py`, `tests/integration/bench_events.py`
**Acceptance criteria**
- Append writes the event and its effect row in one transaction; a failed append performs no effect. No update or delete path for events exists in the module or in the grant (FR-062).
- `seq` is dense and gapless per Run; a gap query returns nothing across the test corpus.
- Folding reproduces State and spend exactly for every fixture stream.
- Two workers cannot hold a lease on the same Run; the loser executes no effect (INV-6).
- Append p95 within NFR-017, recorded to `bench/events.json`.

### PLAT-06 — Content-addressed artifact store
**Role:** platform · **Blocked by:** PLAT-04 · **Blocks:** ORCH-03
**Reading:** [03-adr/0017-content-addressed-artifact-store.md](../03-adr/0017-content-addressed-artifact-store.md), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md)
**Touches:** `made/artifacts/store.py`, `tests/integration/test_artifact_store.py`
**Acceptance criteria**
- Put returns a `sha256`; identical content stores one object.
- Get verifies the digest and raises loudly on mismatch — never returns partial or unverified bytes.
- Metadata row and object are written store-first, then referenced, so a crash leaves an orphan object rather than a dangling reference.

### SBX-00 — SandboxProvider protocol and in-process fake
**Role:** sandbox · **Blocked by:** PLAT-01 · **Blocks:** ORCH-03, SBX-02
**Reading:** [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md), [03-adr/0005-gvisor-v1-firecracker-deferred.md](../03-adr/0005-gvisor-v1-firecracker-deferred.md)
**Touches:** `made/sandbox/provider.py`, `made/sandbox/fake.py`, `tests/unit/test_sandbox_fake.py`
**Acceptance criteria**
- Exactly six operations, matching [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md); `exec` takes an argv list, never a string.
- The fake supports scripted exit codes and outputs for deterministic tests.
- No module outside `made/sandbox/` imports anything runtime-specific; the boundary lint proves it.

### AGENT-00 — Fake agents
**Role:** orchestration · **Blocked by:** PLAT-03 · **Blocks:** ORCH-03
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md) (agent contract), [`/contracts/schemas/`](../../contracts/schemas/)
**Touches:** `made/agents/base.py`, `made/agents/fake.py`, `tests/unit/test_agent_contract.py`
**Acceptance criteria**
- `Agent` protocol and `AgentResult` with an explicitly advisory `proposed_verdict`.
- Fakes return canned, schema-valid artifacts per role, and can be scripted to fail validation.

### ORCH-01 — Graph state and reducers
**Role:** orchestration · **Blocked by:** PLAT-03 · **Blocks:** ORCH-02, ORCH-03
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md) (graph state), [03-adr/0007-git-worktree-as-project-state.md](../03-adr/0007-git-worktree-as-project-state.md)
**Touches:** `made/orchestrator/state.py`, `tests/unit/test_graph_state.py`
**Acceptance criteria**
- Only `attempts` and `guard_trips` are append-reduced; everything else replaces.
- A test asserts no field can hold file contents, and that `spent_usd` is derived rather than incremented.
- Reducer behaviour is documented per field in the module docstring.

### ORCH-02 — Pure routing predicates
**Role:** orchestration · **Blocked by:** ORCH-01 · **Blocks:** ORCH-03
**Reading:** [`/contracts/state-machine.json`](../../contracts/state-machine.json), [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [03-adr/0002-langgraph-as-executor-with-pure-routing.md](../03-adr/0002-langgraph-as-executor-with-pure-routing.md)
**Touches:** `made/orchestrator/routing.py`, `tests/unit/test_routing.py`
**Acceptance criteria**
- One predicate per conditional edge in the contract; the set matches exactly, asserted by a test.
- No IO, no clock, no randomness — enforced by the boundary lint and a forbidden-call check.
- Property test: every `(State, event)` pair is handled and no failure edge returns its own State.
- 100% branch coverage.

### ORCH-03 — Graph construction, checkpointer and driver
**Role:** orchestration · **Blocked by:** ORCH-02, PLAT-05, PLAT-06, SBX-00, AGENT-00 · **Blocks:** API-01, ORCH-07
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [03-adr/0004-event-log-separate-from-checkpoints.md](../03-adr/0004-event-log-separate-from-checkpoints.md)
**Touches:** `made/orchestrator/graph.py`, `made/orchestrator/nodes/**`, `tests/integration/test_fake_run.py`
**Acceptance criteria**
- A Run completes `INTAKE → DONE` with fake agents and the fake sandbox, no network.
- Every State entry and effect emits its event in the effect's transaction.
- Killing the worker at any non-terminal State and restarting resumes to the identical State.
- Deleting all checkpoints for a terminal Run loses no information, asserted by a test.

### API-01 — Control API and error catalogue
**Role:** platform · **Blocked by:** ORCH-03 · **Blocks:** VIEW-01, APPR-01, AUDIT-01
**Reading:** [`/contracts/openapi.yaml`](../../contracts/openapi.yaml), [02-architecture/03-api-design.md](../02-architecture/03-api-design.md)
**Touches:** `made/api/**` (excluding `made/api/templates/**`), `made/errors.py`, `tests/contract/test_openapi.py`
**Acceptance criteria**
- Project, Run, event, approval and cancellation endpoints conform to the published OpenAPI document, verified by a schemathesis-style conformance test.
- Idempotency on Run creation: same key returns the original; same key with a different body returns 409.
- Event pagination is by `seq` cursor; an offset parameter does not exist.
- Role enforcement per endpoint, including that `auditor` cannot create a Run.
- No endpoint returns secret material; no endpoint executes anything on demand.

### CLI-01 — `made` command
**Role:** platform · **Blocked by:** API-01 · **Blocks:** —
**Reading:** [02-architecture/03-api-design.md](../02-architecture/03-api-design.md), [01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md) (persona-to-surface matrix)
**Touches:** `made/cli/**`, `tests/unit/test_cli.py`
**Acceptance criteria**
- `made project register|list`, `made run create|status|events|approve|cancel`, `made audit export`.
- Exit codes distinguish failure classes; a parked Run is reported as parked, never as running.

### INFRA-01 — Compose topology and operator targets
**Role:** infra · **Blocked by:** PLAT-01, PLAT-04 · **Blocks:** INFRA-02
**Reading:** [02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-021)
**Touches:** `deploy/compose.yaml`, `deploy/README.md`, `Makefile`, `tests/contract/test_topology.py`
**Acceptance criteria**
- Exactly four long-running services; a contract test fails on a fifth (NFR-021).
- `make up`, `make down`, `make logs`, `make ps`, `make backup`, `make restore`, `make pause` exist and work.
- No service exposes a port outside localhost by default.

### SPEC-01 — `spec-lint`
**Role:** spec · **Blocked by:** PLAT-01 · **Blocks:** —
**Reading:** [03-adr/0018-spec-as-contract-and-spec-lint.md](../03-adr/0018-spec-as-contract-and-spec-lint.md), [00-context/03-glossary.md](../00-context/03-glossary.md), [03-adr/0019-specification-first-projects.md](../03-adr/0019-specification-first-projects.md) (why the library interface)
**Touches:** `tools/spec_lint/**`, `.github/workflows/spec-lint.yml`, `tests/unit/test_spec_lint.py`
**Acceptance criteria**
- All seven checks from [ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md) implemented, each with a failing fixture.
- Implemented as a **library** with a machine-readable report (findings as structured records: file, line, rule, severity), with the command-line entry point a thin wrapper over it. Same cost today, and it is what later allows the tool to run as a `verification_command` inside a Sandbox ([ADR-0019](../03-adr/0019-specification-first-projects.md)).
- Runs in under 10 seconds on the whole repository.
- Exits non-zero with a message naming the file, the line and the rule.

---

## M1 — Isolation proven

### SBX-01 — Base sandbox image, pinned and reproducible
**Role:** sandbox · **Blocked by:** SBX-00 · **Blocks:** SBX-02
**Reading:** [03-adr/0006-no-network-in-verification-sandbox.md](../03-adr/0006-no-network-in-verification-sandbox.md), [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md)
**Touches:** `deploy/images/**`, `tests/integration/test_image_contents.py`
**Acceptance criteria**
- Image contains Python 3.12, git, ripgrep and the demo repository's dependencies, pinned by hash.
- Image is referenced everywhere by digest; a mutable tag is rejected (FR-008).
- A test asserts no credential-shaped environment variable and no network configuration is baked in.

### SBX-02 — gVisor provider with fail-closed preflight
**Role:** sandbox · **Blocked by:** SBX-01, PLAT-02 · **Blocks:** SBX-03, SBX-04, VER-01
**Reading:** [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md), [03-adr/0005-gvisor-v1-firecracker-deferred.md](../03-adr/0005-gvisor-v1-firecracker-deferred.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-054 to FR-061)
**Touches:** `made/sandbox/gvisor.py`, `made/sandbox/preflight.py`, `tests/integration/test_sandbox_provider.py`
**Acceptance criteria**
- The runtime is selected explicitly per Sandbox, never inherited from a daemon default.
- Preflight verifies from **inside** a Sandbox that the isolation runtime is in effect, not from configuration.
- If the runtime is unavailable or the identity check fails, Run creation is refused; there is no fallback path in the code, asserted by a test that removes the runtime.
- Verification Sandboxes are created with networking disabled and no host bind mounts.
- Paths from callers are symlink-resolved and validated against the workspace root host-side.

### SBX-03 — Resource limits, TTLs and the reaper
**Role:** sandbox · **Blocked by:** SBX-02 · **Blocks:** —
**Reading:** [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md) (L4), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md) (INV-7)
**Touches:** `made/sandbox/limits.py`, `made/sandbox/reaper.py`, `tests/integration/test_sandbox_lifecycle.py`
**Acceptance criteria**
- CPU, memory, PID, disk and per-exec timeout limits are set explicitly at creation and verified from inside.
- Breaching a limit terminates the Sandbox without affecting the host or other Runs.
- The reaper destroys Sandboxes for terminal, cancelled or non-heartbeating Runs within the idle timeout; INV-7 holds after a simulated worker death.

### SBX-04 — Escape suite
**Role:** sandbox · **Blocked by:** SBX-02, SBX-03 · **Blocks:** M2 onwards (release gate)
**Reading:** [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md#escape-test-suite), [04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md), [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)
**Touches:** `tests/escape/**`, `.github/workflows/escape.yml`
**Acceptance criteria**
- Every case in the table implemented against the real runtime and the real image.
- The suite is a required check; a fast subset runs per pull request and the full suite nightly.
- No quarantine, no `xfail`, no known-failures file (NFR-002).
- A deliberately weakened configuration makes the suite fail, proving it detects what it claims to.

### SBX-05 — Sandbox latency benchmark
**Role:** sandbox · **Blocked by:** SBX-02 · **Blocks:** —
**Reading:** [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-001)
**Touches:** `tests/integration/bench_sandbox.py`, `bench/sandbox.json`
**Acceptance criteria**
- 50 consecutive creations measured; p95 and p99 recorded and committed.
- The nightly job fails the budget check when the measurement regresses.

### INFRA-02 — Bootstrap, preflight and the supported host matrix
**Role:** infra · **Blocked by:** INFRA-01, SBX-02 · **Blocks:** M6
**Reading:** [04-engineering/02-local-dev-setup.md](../04-engineering/02-local-dev-setup.md), [02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-020)
**Touches:** `deploy/bootstrap.sh`, `deploy/preflight.sh`, `docs/04-engineering/02-local-dev-setup.md`
**Acceptance criteria**
- Clean-VM bootstrap to passing smoke test within NFR-020, measured by the nightly job.
- Preflight names each missing prerequisite; it never installs the isolation runtime silently.
- **Blocked on OQ-08**: the supported host matrix must be established by running SBX-04 on a Proxmox LXC guest and a Proxmox VM guest, and the result recorded, before this item can be completed.

---

## M2 — Deterministic core

### CTX-01 — Failure normaliser and signature
**Role:** orchestration · **Blocked by:** PLAT-01 · **Blocks:** ORCH-05, VER-01, CTX-03
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [03-adr/0010-termination-guards.md](../03-adr/0010-termination-guards.md)
**Touches:** `made/context/normalise.py`, `tests/unit/test_normalise.py`
**Acceptance criteria**
- Removes absolute paths, timestamps, durations, addresses, temporary names, pids and random ids, in that order; drops frames outside the workspace (FR-038).
- The same logical failure from two different Sandboxes yields an identical signature.
- `failing_count` falls back to 1 when unparseable, and a test asserts the conservative consequence.
- Exactly one implementation exists in the tree; a lint check enforces it. 100% branch coverage.

### CTX-02 — Repo map
**Role:** orchestration · **Blocked by:** PLAT-01 · **Blocks:** CTX-03, TOOL-02
**Reading:** [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md), [03-adr/0009-tool-mediated-retrieval-no-vector-db.md](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md)
**Touches:** `made/context/repo_map.py`, `tests/unit/test_repo_map.py`
**Acceptance criteria**
- Tree-sitter extraction of top-level definitions with signatures and no bodies, for Python.
- Reference-graph ranking, biased by task focus; output fits the 1,500-token budget measured with a real tokeniser.
- Incremental invalidation per changed file; a full rebuild is not triggered by a one-file patch.

### TOOL-01 — Read, search and listing tools
**Role:** sandbox · **Blocked by:** SBX-00 · **Blocks:** TOOL-05
**Reading:** [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md) (toolbelt), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-070 to FR-073)
**Touches:** `made/tools/read_range.py`, `made/tools/grep.py`, `made/tools/list_dir.py`, `tests/unit/test_read_tools.py`
**Acceptance criteria**
- `read_range` returns an outline plus a narrowing request above the line cap rather than the file.
- `grep` results are capped and deduplicated by file; `list_dir` respects `.gitignore`.
- No tool accepts a shell string; no free-form shell tool exists anywhere in the tree.

### TOOL-02 — Symbol tools
**Role:** sandbox · **Blocked by:** CTX-02 · **Blocks:** TOOL-05
**Reading:** [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)
**Touches:** `made/tools/symbols.py`, `tests/unit/test_symbol_tools.py`
**Acceptance criteria**
- `symbol_def` and `references` return workspace-relative locations with signatures, capped in count.
- Results are deterministic for a given tree.

### TOOL-03 — Search/replace patch parser and applier
**Role:** sandbox · **Blocked by:** SBX-00 · **Blocks:** TOOL-04, ORCH-07
**Reading:** [03-adr/0008-search-replace-patch-format.md](../03-adr/0008-search-replace-patch-format.md), [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md) (editing)
**Touches:** `made/tools/apply_patch.py`, `tests/unit/test_apply_patch.py`
**Acceptance criteria**
- Exact, unique byte match required; ambiguity or absence is a structured rejection naming the file and nearest candidate (FR-035).
- No fuzzy matching exists in the implementation, asserted by tests covering whitespace-only and near-miss cases.
- Malformed, nested and truncated block markers are rejected safely. 100% branch coverage.

### TOOL-04 — Patch policy validator
**Role:** sandbox · **Blocked by:** TOOL-03 · **Blocks:** ORCH-05
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md) (GUARD_PATCH_POLICY), [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md), [`/contracts/schemas/artifact-task-graph.schema.json`](../../contracts/schemas/artifact-task-graph.schema.json)
**Touches:** `made/tools/patch_policy.py`, `tests/unit/test_patch_policy.py`, `tests/escape/test_patch_policy_escape.py`
**Acceptance criteria**
- Rejects paths outside the workspace after symlink resolution, oversized patches, and any write to CI configuration, git hooks or submodule pointers (FR-036).
- When the Task declares a `touches` scope, rejects any write outside it after symlink resolution; when absent, the workspace-wide policy applies unchanged (FR-080).
- Rejection is a typed policy violation that routes the Run to escalation rather than a retry. 100% branch coverage.

### TOOL-05 — Toolbelt factory with per-State authority
**Role:** orchestration · **Blocked by:** TOOL-01, TOOL-02, TOOL-03 · **Blocks:** AGENT-01
**Reading:** [`/contracts/state-machine.json`](../../contracts/state-machine.json), [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)
**Touches:** `made/tools/toolbelt.py`, `tests/unit/test_toolbelt_authority.py`
**Acceptance criteria**
- The belt is constructed from the State's declared authority in the contract; grants are not parameters an agent can influence (FR-069).
- A test asserts a `VERIFY` belt cannot construct a write tool and that `run_verification` accepts no arguments.

### VER-01 — Verification executor
**Role:** orchestration · **Blocked by:** SBX-02, CTX-01 · **Blocks:** ORCH-05, ORCH-07
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [03-adr/0014-verification-oracle-is-authoritative.md](../03-adr/0014-verification-oracle-is-authoritative.md)
**Touches:** `made/orchestrator/verify.py`, `tests/integration/test_verification.py`
**Acceptance criteria**
- Executes the Task's `verification_command` verbatim as argv, with no network and no model in the path.
- Produces a `TestReport` with exit code, normalised output, signature and failing count.
- Distinguishes *verified*, *failed verification* and *not verified*, and a timeout is the third (FR-045).
- No code path allows an agent to alter the command or the result.

### ORCH-05 — Guards
**Role:** orchestration · **Blocked by:** CTX-01, TOOL-04, VER-01, LEDG-01 · **Blocks:** ORCH-07
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [03-adr/0010-termination-guards.md](../03-adr/0010-termination-guards.md)
**Touches:** `made/orchestrator/guards.py`, `tests/unit/test_guards.py`
**Acceptance criteria**
- All six guards implemented as pure functions taking data, not repositories.
- `GUARD_PROGRESS` refuses on a repeated patch hash, and on a repeated signature with no reduction in failing count (FR-040).
- `GUARD_CYCLE` detects a repeated `(state, task, tree hash, inputs)` tuple (FR-041).
- Attempt caps are read from persisted Attempts so a restart cannot reset them. 100% branch coverage.

### ORCH-06 — Plan validator
**Role:** orchestration · **Blocked by:** PLAT-03 · **Blocks:** AGENT-02
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-024, FR-025, FR-030)
**Touches:** `made/orchestrator/plan_validator.py`, `tests/unit/test_plan_validator.py`
**Acceptance criteria**
- Rejects a graph containing any Task with an empty or absent `verification_command`, a cycle, or more Tasks than the Project ceiling.
- A second consecutive rejection routes to `AWAIT_HUMAN`, not to a third attempt.
- **Constrained by OQ-07**: implement Project-declared command templates as the required path; Architect-generated commands are accepted only behind a configuration flag, default off.

### LEDG-01 — Cost ledger and admission control
**Role:** platform · **Blocked by:** PLAT-05 · **Blocks:** ORCH-05, LLM-01
**Reading:** [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-009)
**Touches:** `made/store/ledger.py`, `tests/unit/test_admission.py`, `tests/integration/test_budget_enforcement.py`
**Acceptance criteria**
- Admission checks Task, Run, Project and deployment ceilings using a real tokeniser count plus maximum output tokens.
- Denial is a transition to `AWAIT_HUMAN(budget_exhausted)`, never an exception and never a tier downgrade (FR-051).
- Pending rows older than the call timeout are counted as spent and flagged unconfirmed.
- No Run's terminal spend exceeds its ceiling across the test corpus; reconciliation error within NFR-009.

---

## M3 — First agent loop

### LLM-01 — LLM client: tiers, metering, idempotency, fallback
**Role:** llm · **Blocked by:** LEDG-01, PLAT-02 · **Blocks:** LLM-02, AGENT-01
**Reading:** [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md), [03-adr/0012-model-tiers-and-provider-abstraction.md](../03-adr/0012-model-tiers-and-provider-abstraction.md), [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)
**Touches:** `made/llm/client.py`, `made/llm/tokenizer.py`, `tests/unit/test_llm_client.py`
**Acceptance criteria**
- Calling code names a tier; no vendor name appears outside `made/llm/providers/`, enforced by lint.
- Every call records tokens, cached tokens, cost, latency, provider, pinned model, tier, prompt version, fallback flag and `usage_estimated`, in the event's transaction (FR-050).
- Idempotency key prevents a duplicate charge across a simulated crash.
- Schema failure retries once with a repair instruction, then fails the State (FR-052).
- Each tier has a configured fallback endpoint, used on an availability error and recorded on the call (FR-048).
- Both endpoints unavailable parks the Run; no tier substitution occurs, asserted by a test.

### LLM-02 — OpenAI-compatible provider adapter
**Role:** llm · **Blocked by:** LLM-01 · **Blocks:** EVAL-01
**Reading:** [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md), [02-architecture/14-integrations.md](../02-architecture/14-integrations.md)
**Touches:** `made/llm/providers/**`, `tests/integration/test_provider_adapter.py`
**Acceptance criteria**
- One adapter serves hosted and local endpoints; a local endpoint is exercised in the integration suite.
- Structured output requested natively where supported and validated locally regardless.
- Rate limiting and availability errors surface as availability failures, not Task failures.

### CTX-03 — Prompt assembler
**Role:** llm · **Blocked by:** CTX-01, CTX-02, LLM-01 · **Blocks:** AGENT-01
**Reading:** [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-013, NFR-014)
**Touches:** `made/context/assembler.py`, `tests/unit/test_assembler.py`
**Acceptance criteria**
- Section budgets enforced with the target tokeniser; over budget raises rather than truncating (FR-072).
- Agents receive the ranked repo map by default; repository content reaches a prompt only as a labelled tool result (FR-071).
- Fixed section order with the cache breakpoint after the stable prefix; a test asserts the prefix is byte-identical across two Attempts of the same Task.
- Tool results are wrapped with provenance and an untrusted marker (FR-075).
- No prompt string can be constructed outside this module, enforced by lint.

### AGENT-01 — Developer agent
**Role:** orchestration · **Blocked by:** CTX-03, TOOL-05, AGENT-00 · **Blocks:** ORCH-07
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md), [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)
**Touches:** `made/agents/developer.py`, `made/agents/prompts/developer/**`, `tests/integration/test_developer_agent.py`
**Acceptance criteria**
- Produces a schema-valid `Patch` from a Task plus repo map plus attempt history, using the `EDIT` tier.
- Prompt version recorded on every call; prompt files versioned by name.
- Against the fake provider, the whole loop is deterministic and offline.

### ORCH-07 — Implement and Verify wiring with a real agent
**Role:** orchestration · **Blocked by:** AGENT-01, ORCH-05, VER-01, TOOL-03 · **Blocks:** ORCH-08
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)
**Touches:** `made/orchestrator/nodes/implement.py`, `made/orchestrator/nodes/verify.py`, `tests/integration/test_single_task_run.py`
**Acceptance criteria**
- A Run with a human-written Task reaches verified within the ceiling.
- Lint and syntax run after patch application and before any model call (FR-037).
- The unsatisfiable variant parks in `AWAIT_HUMAN` within the attempt cap and under 25% of the ceiling (NFR-012).
- Forcing an identical patch twice is refused by the progress oracle.

### VIEW-01 — Run viewer
**Role:** platform · **Blocked by:** API-01 · **Blocks:** —
**Reading:** [03-adr/0028-web-console-as-a-product-surface.md](../03-adr/0028-web-console-as-a-product-surface.md), [03-adr/0016-server-rendered-run-viewer.md](../03-adr/0016-server-rendered-run-viewer.md) (superseded; read for the retained technology argument), [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md), [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)
**Touches:** `made/api/templates/**`, `made/api/views.py`, `tests/integration/test_viewer.py`
**Acceptance criteria**
- Run list and detail with event timeline, per-step cost, Tasks with verification results, artifacts, and spend against ceiling (FR-067).
- Truthfulness rules asserted by tests: the three verification words; a parked Run shown as waiting with its reason and never as a spinner; unknown rendered as "unknown" and never as zero.

---

## M3b — The first work class (the critical path to revenue)

Replaces M4 on the critical path ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)).
No Architect, no generated planning.

### WORK-01 — Work-class registry and fixed task templates
**Role:** orchestration · **Blocked by:** ORCH-07, ORCH-06 · **Blocks:** WORK-02, WORK-03, WORK-04
**Reading:** [01-product/05-work-classes.md](../01-product/05-work-classes.md), [03-adr/0020-technical-debt-remediation-as-the-v1-product.md](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), [`/contracts/schemas/artifact-task-graph.schema.json`](../../contracts/schemas/artifact-task-graph.schema.json)
**Touches:** `made/workclasses/**`, `made/orchestrator/nodes/intake.py`, `tests/unit/test_work_classes.py`
**Acceptance criteria**
- A class declares a task template, a `verification_command`, a `touches` scope and an oracle; the registry validates all four at load.
- A Run created from a class reaches `IMPLEMENT` with **zero** model calls in `SPEC` or `PLAN`, asserted by counting `llm_calls` rows (FR-081).
- The instantiated Task passes the same `GUARD_PLAN_VALID` checks as a generated one — the template is not a bypass.
- Enabling a class on a Project executes its oracle against the base branch and refuses if it cannot run (FR-085).

### WORK-02 — The `dependency_upgrade` work class
**Role:** orchestration · **Blocked by:** WORK-01 · **Blocks:** GIT-02 (for the first sellable path)
**Reading:** [01-product/05-work-classes.md](../01-product/05-work-classes.md), [02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md), [03-adr/0006-no-network-in-verification-sandbox.md](../03-adr/0006-no-network-in-verification-sandbox.md)
**Touches:** `made/workclasses/dependency_upgrade.py`, `made/workclasses/manifests/**`, `tests/integration/test_dependency_upgrade.py`
**Acceptance criteria**
- Bumps a dependency in a manifest, and when the bump breaks the suite, locates and fixes the affected call sites.
- Records the manifest change and the resolved versions on the Run.
- Rejects a patch that edits a manifest without a consistent lockfile update (FR-083).
- On a seed repository with a deliberately breaking minor upgrade, produces a branch whose existing suite passes.
- **Blocked on OQ-09**: how the new package version reaches a Sandbox that has no network. Do not implement a network path; resolve the question first.

### WORK-03 — Scheduler for recurring Runs
**Role:** platform · **Blocked by:** WORK-01, LEDG-01 · **Blocks:** —
**Reading:** [01-product/05-work-classes.md](../01-product/05-work-classes.md) (scheduling), [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-021)
**Touches:** `made/store/schedules.py`, `made/orchestrator/scheduler.py`, `tests/integration/test_scheduler.py`
**Acceptance criteria**
- A schedule per Project and work class creates Runs without a person (FR-082).
- Runs as a loop inside the existing worker; the process count is unchanged, asserted by the topology test (NFR-021).
- A schedule fanning out beyond the concurrency cap or a budget ceiling is refused, not queued invisibly — the case the guards exist for.
- A missed window does not backfill silently; a skipped Run is an event with a reason.

### ~~WORK-04~~ — The `pr_review` work class, advisory only
**Superseded by ADV-01 and ADV-02.** The read-only requirement it implemented ([FR-084](../01-product/03-functional-requirements.md))
is **withdrawn**: producing evidence means writing a failing test, so a read-only advisory class is
incompatible with [ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md). The item is retained
struck through so that an agent finding a reference to it learns why it is gone rather than concluding
the backlog is incomplete. Its surviving clause — the Run is never reported as verified — is
[FR-086](../01-product/03-functional-requirements.md) and is covered by ADV-01.

---

## M2b — Tenancy enforced

### TEN-01 — Tenant scoping, row-level security and the store boundary
**Role:** platform · **Blocked by:** CON-01, PLAT-04, PLAT-05 · **Blocks:** every item that reads tenant-scoped data
**Reading:** [02-architecture/18-deployment-and-tenancy.md](../02-architecture/18-deployment-and-tenancy.md), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (Epic Q)
**Touches:** `made/store/tenancy.py`, `made/store/**` (query paths), `migrations/**`, `tests/escape/test_cross_tenant_*.py`, `tests/integration/test_tenancy.py`
**Acceptance criteria**
- Tenant is resolved from the authenticated principal; no code path accepts a tenant from a request field, header or path, asserted by a test (FR-141).
- Row-level security is active in the test database, and **a deliberately predicate-less tenant-scoped query is refused by the database** — the test that proves the boundary rather than the application.
- At least 15 seeded cross-tenant access attempts across every tenant-scoped table return nothing (NFR-029, INV-10).
- Two synthetic tenants hold colliding branch names, artifact digests and work-class names without a constraint violation.
- A static check over `made/store/` fails on a tenant-scoped query with no tenant predicate.
- An artifact digest from one tenant does not resolve for another (FR-144).

### TEN-02 — Identity, teams, entitlements and approval policy
**Role:** platform · **Blocked by:** TEN-01, API-01 · **Blocks:** CHAT-01, CONS-02
**Reading:** [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), [02-architecture/03-api-design.md](../02-architecture/03-api-design.md)
**Touches:** `made/api/routes/admin.py`, `made/store/identity.py`, `made/store/entitlements.py`, `tests/integration/test_approval_policy.py`
**Acceptance criteria**
- Users, teams, principals and roles exist; every principal belongs to exactly one tenant (FR-145).
- Entitlements are administered per principal and are **never** derived from an external platform's group or channel membership (FR-107).
- An approval policy binds `(scope, lane, work class)` to principals with a minimum count; **saving one that would leave a scope with no eligible approver is rejected** (FR-135).
- Self-approval of one's own request is refused by default.
- Every administrative action writes an `admin_action` event with its actor and the configuration versions (FR-134).
- The `auditor` role cannot create work or approve; the `requester` role sees only its own requests (FR-136).

### TEN-03 — Deployment mode and the bootstrap tenant
**Role:** platform · **Blocked by:** TEN-01, PLAT-02 · **Blocks:** —
**Reading:** [02-architecture/18-deployment-and-tenancy.md](../02-architecture/18-deployment-and-tenancy.md), [02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)
**Touches:** `made/config/**`, `deploy/bootstrap.sh`, `tests/contract/test_mode_boundary.py`
**Acceptance criteria**
- `self_hosted` bootstrap creates exactly one tenant and one `operator` principal; the API exposes no tenant creation in that mode (FR-142).
- **No module outside `made/config/` reads `deployment_mode`**, and no behaviour branches on it, enforced by the import-boundary lint (FR-143).
- A test asserts no capability is registered in one mode and absent in the other.
- **Constrained by OQ-23**: implement the identity-provider path as required and local accounts as a bootstrap-only fallback (FR-146). Do not resolve the question.

---

## M3c — Residency: ingestion, visible queues and durable scheduling

### RES-01 — Ingress endpoints and the ingress event log
**Role:** platform · **Blocked by:** CON-05, API-01, TEN-01 · **Blocks:** RES-02, ADV-02, CHAT-01
**Reading:** [02-architecture/17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md), [03-adr/0026-resident-agents-event-ingestion-visible-queues.md](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)
**Touches:** `made/api/ingress/**`, `made/store/ingress.py`, `tests/integration/test_ingress.py`
**Acceptance criteria**
- An endpoint authenticates, verifies the provider signature, records an `ingress_event`, and returns. **It performs no model call, no Sandbox operation and no git operation**, enforced by the import-boundary lint (FR-116).
- A redelivery of the same `(source, provider_delivery_id)` produces **no second Run**, asserted across a simulated burst (NFR-033, INV-16).
- An event that will produce nothing is still recorded with the reason: unmapped identity, no class enabled, worksites paused.
- An event that cannot be recorded is **not acted on**; with Postgres unavailable the endpoint rejects rather than accepting and losing.
- A polling adapter produces identical rows with the same key, so nothing downstream knows which mechanism was used.

### RES-02 — The visible work queue and four-level admission
**Role:** platform · **Blocked by:** RES-01, LEDG-01 · **Blocks:** WS-01
**Reading:** [02-architecture/17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md), [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)
**Touches:** `made/store/queue.py`, `made/orchestrator/admission.py`, `tests/integration/test_queue.py`
**Acceptance criteria**
- Every queued row carries position, enqueue time, reason and cause; none can be inserted without them (FR-117, INV-17, NFR-034).
- Claiming uses `SELECT … FOR UPDATE SKIP LOCKED`; two workers never claim the same item.
- Every queue is bounded, and reaching a bound **sheds with a recorded reason** rather than growing.
- Admission is checked at deployment, tenant, project and worksite level **before the Run row exists**; a test asserts no unadmittable Run is ever created (FR-119).
- A human-submitted API request at capacity still receives `429`, unchanged.
- Per-tenant queue wait is exposed as a metric, because tenant fairness is the known weak point and must be observable ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

### RES-03 — Durable scheduling with recorded skips
**Role:** platform · **Blocked by:** RES-02, WORK-03 · **Blocks:** WS-01
**Reading:** [02-architecture/17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md), [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md)
**Touches:** `made/orchestrator/scheduler.py`, `made/store/schedules.py`, `tests/integration/test_scheduler_durability.py`
**Acceptance criteria**
- Schedules survive a restart and resume from persisted state.
- A missed window is a recorded `schedule_skipped` event with a reason and **produces no backfill burst** (FR-118).
- **No clock read appears in any routing predicate, guard or campaign oracle**; the driver delivers time as an event. Enforced by the forbidden-call check, and asserted for all five time-bearing mechanisms.
- The ingestion alert fires when no ingress event arrives from a configured source within its interval, demonstrated by stopping the source.

---

## M3d — The first worksite

**Blocked on OQ-11.** Which work class the first worksite supports changes the slice rule and the seed
repository, so none of these items is ready until it is answered.

### WS-01 — Worksite entity, survey and the cycle loop
**Role:** orchestration · **Blocked by:** CON-03, RES-02, RES-03, WORK-01 · **Blocks:** WS-02, WS-03, WS-04
**Reading:** [01-product/07-worksites.md](../01-product/07-worksites.md), [03-adr/0024-worksites-as-long-running-campaigns.md](../03-adr/0024-worksites-as-long-running-campaigns.md)
**Touches:** `made/worksites/driver.py`, `made/store/worksites.py`, `tests/integration/test_worksite_cycle.py`
**Acceptance criteria**
- A worksite whose progress command does not run, or whose output does not parse as an integer, **fails to activate**, reporting the command, exit code and output (FR-095).
- The progress command is executed against the **default branch**, and `progress_measured` records the command, the commit and the integer (FR-096).
- Each cycle surveys, plans slices, and creates Runs one at a time through admission; a worksite creates Runs and **never** Tasks (FR-099).
- Delivered-but-unmerged pull requests are recorded as work in flight and never counted as progress; a test asserts no code path sums them into the remaining count.
- Configuration is immutable per version and every Run records the version it ran under (FR-104).
- Folding the worksite event log reproduces state, cycle number, counts and spend exactly (NFR-041, INV-18).

### WS-02 — Worksite ceilings and the campaign progress oracle
**Role:** orchestration · **Blocked by:** WS-01 · **Blocks:** —
**Reading:** [01-product/07-worksites.md](../01-product/07-worksites.md), [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [03-adr/0010-termination-guards.md](../03-adr/0010-termination-guards.md)
**Touches:** `made/worksites/oracle.py`, `made/worksites/ceilings.py`, `tests/unit/test_campaign_oracle.py`
**Acceptance criteria**
- The oracle is a **pure function reading `worksite_cycle` rows and nothing else**, with 100% branch coverage — the same property that makes `GUARD_PROGRESS` testable.
- No fall in the remaining count across the declared cycle count pauses the worksite and escalates, and the escalation **distinguishes failed slices from unmerged pull requests** (FR-098).
- Each of the four ceilings is demonstrated tripping; none can be raised while the worksite is active (FR-097, NFR-032, INV-14).
- **Constrained by OQ-11 and NFR-040**: the declared cycle count is recorded from the first worksite's own history, not chosen. Ship the mechanism with the value configurable and unset by default.

### WS-03 — Exclusive path claims
**Role:** orchestration · **Blocked by:** WS-01 · **Blocks:** —
**Reading:** [01-product/07-worksites.md](../01-product/07-worksites.md), [02-architecture/17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md)
**Touches:** `made/worksites/claims.py`, `tests/integration/test_claims.py`
**Acceptance criteria**
- Overlap is detected by prefix comparison under a row lock; two active claims never overlap in one repository (FR-100, INV-15).
- A blocked worksite records its waiting state, the blocking claim and the wait's age, and appears on the queue page — **it does not fail and does not proceed**.
- A paused or terminal worksite releases its claims.
- Claim age is exposed as a metric, because whether claims block more than they protect is the revisit trigger.

### WS-04 — Pause, resume and re-survey
**Role:** orchestration · **Blocked by:** WS-01 · **Blocks:** —
**Reading:** [01-product/07-worksites.md](../01-product/07-worksites.md)
**Touches:** `made/worksites/lifecycle.py`, `tests/integration/test_worksite_lifecycle.py`
**Acceptance criteria**
- Pausing stops new Run creation; in-flight Runs finish or park.
- **Leaving `PAUSED` requires a recorded human decision**; there is no automatic resumption path in the code, asserted by a test (FR-103).
- Resuming re-executes the progress command and re-plans before creating anything (FR-102).
- A slice Run whose base is no longer the default-branch head is re-planned rather than delivered (FR-105).
- A worker restart mid-cycle resumes from the worksite event log with no duplicated Run.

---

## M3e — The first advisory class

**Blocked on OQ-12.** Which advisory capability ships first is unresolved.

### ADV-01 — The `ASSESS` state, findings and evidence records
**Role:** orchestration · **Blocked by:** CON-02, VER-01, TOOL-05, AGENT-05 · **Blocks:** ADV-02, CONS-03
**Reading:** [01-product/06-lanes.md](../01-product/06-lanes.md), [03-adr/0022-two-lanes-verified-and-advisory.md](../03-adr/0022-two-lanes-verified-and-advisory.md), [03-adr/0023-advisory-findings-carry-evidence.md](../03-adr/0023-advisory-findings-carry-evidence.md)
**Touches:** `made/orchestrator/nodes/assess.py`, `made/store/findings.py`, `made/agents/reviewer.py`, `tests/integration/test_assess.py`, `tests/escape/test_evidence_workspace.py`
**Acceptance criteria**
- Every finding carries an `evidence_state`; `demonstrated` references an evidence record holding argv, the tree's commit and patch digest, exit code and normalised output (FR-088).
- Evidence uses **the same executor and the same normaliser** as verification; a test asserts there is exactly one normaliser in the tree.
- An evidence record emits `evidence_recorded`, **never** `verification_completed`; it does not satisfy INV-2 and cannot mark a Task successful (FR-092, INV-12, INV-13).
- A concern with no executable form is emitted labelled `unverified`; **suppressing it is not a configurable behaviour** (FR-149).
- The advisory toolbelt can write and execute **only** inside the evidence workspace; attempts to patch or push the reviewed branch, or to submit an approving review, fail from the State's grant rather than from prompt instruction (FR-091).
- An advisory Run is never reported as *verified*, *failed verification* or *not verified* (FR-086), and is bounded by budget admission, the attempt cap and the TTL (FR-093).
- No edge exists from the advisory sub-graph into `IMPLEMENT`, asserted against the contract.

### ADV-02 — Finding delivery, and the advisory eval tier
**Role:** llm · **Blocked by:** ADV-01, RES-01, GIT-03 · **Blocks:** —
**Reading:** [01-product/06-lanes.md](../01-product/06-lanes.md), [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md), [04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md)
**Touches:** `made/git/findings.py`, `tests/eval/tasks/advisory/**`, `tests/fixtures/repos/**`
**Acceptance criteria**
- Findings are delivered as comments on the human's pull request; `demonstrated` leads with its command and exit code, `unverified` leads with that word, and the two do not share formatting (FR-089).
- On a seed repository with a real defect no existing test catches, the class produces a finding whose evidence **fails on the branch and passes on its base**.
- **On a pull request with no defect, no finding is produced** — the required fixture that catches a model rewarded for finding things.
- Golden cases assert the recorded `evidence_state` matches whether an evidence record was produced, and that no finding was emitted with neither (FR-148, FR-149).
- The evidence ratio is measured and **recorded as the NFR-030 baseline**. Recording it is the criterion; a target value is not, and a low number is answered by narrowing the concern types rather than relaxing the label.

---

## M3f — The console and the effectiveness dashboard

**Blocked on OQ-18**, and partly forced by OQ-01.

### CONS-01 — Console pages for worksites, requests, findings and the queue
**Role:** platform · **Blocked by:** CON-06, VIEW-01 · **Blocks:** —
**Reading:** [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), [03-adr/0028-web-console-as-a-product-surface.md](../03-adr/0028-web-console-as-a-product-surface.md)
**Touches:** `made/api/templates/**`, `made/api/views.py`, `tests/integration/test_console_truthfulness.py`
**Acceptance criteria**
- Every display rule in FR-132 is asserted, including the lane visible before the content, `demonstrated` rendered differently from `unverified`, work in flight never rendered as progress, and a queued item showing position, age and cause (NFR-037).
- **Server-rendered only**: no separate frontend build, no client framework, no second deployment artifact (FR-133).
- No console route exists that the published API does not, asserted as a subset (FR-137).
- Repository access status shows `access_revoked` and `access_insufficient` with the missing permission and what to do, so a fail-closed boundary does not look like an outage.

### CONS-02 — Budgets, alerts and administration
**Role:** platform · **Blocked by:** CON-06, TEN-02 · **Blocks:** —
**Reading:** [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), [02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)
**Touches:** `made/api/routes/admin.py`, `made/api/templates/admin/**`, `tests/integration/test_admin.py`
**Acceptance criteria**
- Ceilings and alert thresholds are settable at tenant, team, repository and worksite level (FR-134).
- No surface raises a ceiling on an active worksite, and none raises a cap mid-Run.
- No surface executes anything on demand, forces a transition, mutates history, or performs a bulk approval (FR-137).
- Every action is an `admin_action` event with its actor.

### CONS-03 — The effectiveness dashboard and its published queries
**Role:** platform · **Blocked by:** CON-06, ADV-01, WS-01, GIT-03 · **Blocks:** M6
**Reading:** [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), [03-adr/0028-web-console-as-a-product-surface.md](../03-adr/0028-web-console-as-a-product-surface.md), [00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)
**Touches:** `made/effectiveness/**`, `made/api/templates/effectiveness/**`, `bench/acceptance_measure.json`, `tests/integration/test_effectiveness.py`
**Acceptance criteria**
- Every measure in FR-130 is computed from the event log by a **published query**, and running that query by hand reproduces the displayed figure (FR-131).
- `made/effectiveness/` contains **queries only**: no table it writes, no cached figure, no rollup, enforced by the import-boundary lint.
- Every measure displays the count it came from; too few observations renders as "insufficient data", never 0% and never a percentage over a handful of samples (FR-139).
- **No figure is blended across lanes**, asserted by a test (FR-094).
- **"Merged with no human edit" is verified against a hand-checked sample of at least 20 merged pull requests spanning a rebase, a squash and a concurrent unrelated commit** (NFR-039). Disagreement in the flattering direction is treated as a defect. Every kill criterion depends on this.
- No cross-tenant figure is computed without recorded per-tenant consent (FR-138).

---

## M3g — The chat front door

**Blocked on OQ-12 and OQ-22**, and constrained by **OQ-19**.

### CHAT-01 — Requests, entitlements and the broker
**Role:** orchestration · **Blocked by:** CON-04, TEN-02, RES-01 · **Blocks:** CHAT-02, CHAT-03
**Reading:** [01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md), [03-adr/0025-chat-front-door-request-broker.md](../03-adr/0025-chat-front-door-request-broker.md)
**Touches:** `made/requests/**`, `made/agents/triager.py`, `tests/integration/test_request_broker.py`
**Acceptance criteria**
- A message becomes a `request`, and a request is not a Run (FR-106).
- **`requests/entitlements.py` does not import `llm`**: the authorisation check runs before and independently of any model call, enforced by the import-boundary lint (FR-107).
- An unmapped identity creates no request and receives a decline naming the missing mapping; channel membership confers nothing.
- A message matching no entitled class is declined with a reason from the closed set; **it is never converted into a Run carrying free-text intent** (FR-108).
- Clarification is bounded by a declared question count and TTL, never exceeded (FR-109, NFR-038); triage passes through budget admission against the requester's allowance (FR-110).
- Ambiguity after the allowance is declined and **never proceeds on an inferred value** (FR-111).
- The Triager has **no repository access**, asserted by its toolbelt.
- **Constrained by OQ-19**: `requires_generated_plan` is emitted for anything needing a plan, and its distribution is queryable. Do not implement generated planning.

### CHAT-02 — One chat adapter and the posting allowlist
**Role:** platform · **Blocked by:** CHAT-01 · **Blocks:** CHAT-03
**Reading:** [01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md), [02-architecture/14-integrations.md](../02-architecture/14-integrations.md), [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)
**Touches:** `made/chat/**`, `tests/escape/test_chat_egress_redaction.py`
**Acceptance criteria**
- **The posting allowlist lives only in `made/chat/`**, and only this module may name a chat platform, enforced by the import-boundary lint (FR-114).
- Against a seeded corpus of at least 20 source-shaped and credential-shaped values planted in Run and finding data, **no post contains source, patch content, verification output, repository paths, file names or finding bodies** (NFR-036).
- Every post is recorded as both an `egress_decision` and a `chat_posted` event, and the whole path is disableable per deployment.
- The system posts only into threads it was addressed in; there is no code path that posts unprompted (FR-150).
- A post failure is recorded and the request is **never reported as answered**.
- **Constrained by OQ-22**: build one adapter. Do not build a second.

### CHAT-03 — Requester progress and the triage eval tier
**Role:** llm · **Blocked by:** CHAT-02, CONS-01 · **Blocks:** —
**Reading:** [01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md), [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)
**Touches:** `made/api/views.py` (requester view), `tests/eval/tasks/chat_triage/**`
**Acceptance criteria**
- A requester follows their request in-thread and through a read-only view scoped to their entitlement, **without a git-host account and gaining no repository access** (FR-113).
- A requester cannot approve delivery of their own request (FR-135).
- The `chat_triage` eval tier covers matching, unmatchable, ambiguous and injection-bearing messages, and asserts that three of the four are declined with the correct reason.
- An injection-bearing message produces at most a Run of a class the requester was already entitled to invoke, with parameters they could have supplied directly.

---

## M3h — Repository access envelope

Sequenced with M3b because delivery depends on it.

### GIT-03 — Scoped application identity and the permission envelope
**Role:** platform · **Blocked by:** CON-05, GIT-01 · **Blocks:** GIT-02, ADV-02, CONS-03
**Reading:** [02-architecture/19-repository-access.md](../02-architecture/19-repository-access.md), [03-adr/0027-scoped-application-identity-branches-only.md](../03-adr/0027-scoped-application-identity-branches-only.md)
**Touches:** `made/git/identity.py`, `made/git/envelope.py`, `made/git/hosts/**`, `tests/escape/test_permission_envelope.py`
**Acceptance criteria**
- The credential is the system's own application installation per tenant; **a human's personal access token is rejected at configuration time** in every deployment mode (FR-122).
- The envelope is enforced **where requests are constructed**, so a host misconfiguration granting more does not widen behaviour (FR-123).
- **One test per prohibition** — default-branch push, force-push, branch delete or rename, tag or release, protection or settings change, CI-secret access, merge, auto-merge, dismiss review, approving review — each asserting the attempt fails inside our code and never reaches the host (NFR-035).
- Registration enumerates required permissions and refuses if any is absent, naming the permission and the class needing it (FR-124).
- A missing permission at run time parks with `access_insufficient`; **there is no fallback path in the code**, asserted by a test that removes a grant (FR-125).
- Revocation at the host parks affected Runs with `access_revoked`, releases worksite claims, attempts no further operation and **schedules no retry** (FR-126).
- Every git operation writes a `git_operation` event with operation, ref, identity and outcome (FR-128).
- The per-host table separating what we enforce from what the host enforces is written and accurate.

## M4 — Multi-agent and generated planning (deferred behind first revenue)

### AGENT-02 — Architect: Spec and TaskGraph
**Role:** orchestration · **Blocked by:** ORCH-06, CTX-03 · **Blocks:** ORCH-08
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [`/contracts/schemas/artifact-task-graph.schema.json`](../../contracts/schemas/artifact-task-graph.schema.json)
**Touches:** `made/agents/architect.py`, `made/agents/prompts/architect/**`, `tests/integration/test_architect.py`
**Acceptance criteria**
- Produces a schema-valid `Spec` and `TaskGraph` on the `PLAN` tier; every Task carries a kind and a verification command.
- Ambiguity above the Project threshold routes to `AWAIT_HUMAN(ambiguous_request)` rather than guessing (FR-029).
- **Constrained by OQ-07** exactly as ORCH-06.

### AGENT-03 — QA agent and the double-execution oracle
**Role:** orchestration · **Blocked by:** AGENT-02, VER-01 · **Blocks:** ORCH-09
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md) (oracles by Task kind)
**Touches:** `made/agents/qa.py`, `made/agents/prompts/qa/**`, `made/orchestrator/oracles.py`, `tests/integration/test_qa_double_execution.py`
**Acceptance criteria**
- A Task of kind `test` passes only when the new test fails against the pre-change tree and passes against the post-change tree.
- A trivially-passing test (for example `assert True`) fails the Task, asserted by a test.

### AGENT-04 — DevOps agent and IaC validators
**Role:** orchestration · **Blocked by:** AGENT-02 · **Blocks:** ORCH-09
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md) (no model-authored image builds)
**Touches:** `made/agents/devops.py`, `made/agents/prompts/devops/**`, `tests/integration/test_devops_agent.py`
**Acceptance criteria**
- Produces Dockerfiles, Compose files and pipeline definitions verified by static validators inside the Sandbox.
- No code path builds or runs a model-authored image; asserted by a test.

### AGENT-05 — Reviewer, advisory only
**Role:** orchestration · **Blocked by:** AGENT-01 · **Blocks:** ORCH-08
**Reading:** [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md), [03-adr/0014-verification-oracle-is-authoritative.md](../03-adr/0014-verification-oracle-is-authoritative.md)
**Touches:** `made/agents/reviewer.py`, `made/agents/prompts/reviewer/**`, `tests/unit/test_reviewer_advisory.py`
**Acceptance criteria**
- Verdict type permits `approve`, `revise` and `escalate` only, and the routing signature makes marking success without a zero exit code unrepresentable (FR-042).
- Findings carry file and line and are attached to the branch.

### ORCH-08 — Task selection and Task lifecycle
**Role:** orchestration · **Blocked by:** AGENT-02, AGENT-05, ORCH-07 · **Blocks:** ORCH-09
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [02-architecture/02-data-model.md](../02-architecture/02-data-model.md) (Task lifecycle)
**Touches:** `made/orchestrator/nodes/task_select.py`, `made/orchestrator/tasks.py`, `tests/integration/test_multi_task_run.py`
**Acceptance criteria**
- Sequential topological execution; no concurrency (FR-027).
- A Task never returns from `DONE` or `FAILED`; a replan creates new Tasks with new identifiers.
- A two-Task request with a dependency succeeds end to end.

### ORCH-09 — Integrate
**Role:** orchestration · **Blocked by:** ORCH-08, AGENT-03, AGENT-04 · **Blocks:** GIT-02
**Reading:** [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-043)
**Touches:** `made/orchestrator/nodes/integrate.py`, `tests/integration/test_integrate.py`
**Acceptance criteria**
- The Project's full verification suite runs and passes in a Sandbox before delivery; a Task-level pass is insufficient.
- Failure routes to `AWAIT_HUMAN(integration_failed)` with the report attached.

### APPR-01 — Durable approval gates
**Role:** platform · **Blocked by:** API-01, ORCH-03 · **Blocks:** GIT-02
**Reading:** [03-adr/0011-durable-human-approval-gates.md](../03-adr/0011-durable-human-approval-gates.md), [02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md)
**Touches:** `made/api/routes/approvals.py`, `made/orchestrator/nodes/await_human.py`, `tests/integration/test_approvals.py`
**Acceptance criteria**
- Entering `AWAIT_HUMAN` destroys the Sandbox and holds no process; resuming recreates it from the pinned digest and recorded head commit.
- An approval records actor, decision, reason, unblocked State and the artifact digests shown.
- Approval is idempotent on `(run_id, awaiting_state, decision)`.
- An unanswered gate terminates in `ABORTED` at TTL.

### GIT-01 — Mirrors, patch extraction and commit trailers
**Role:** platform · **Blocked by:** SBX-02, TOOL-03 · **Blocks:** GIT-02
**Reading:** [03-adr/0007-git-worktree-as-project-state.md](../03-adr/0007-git-worktree-as-project-state.md), [03-adr/0015-credential-brokering-no-secrets-in-sandbox.md](../03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)
**Touches:** `made/git/**` (excluding `made/git/delivery.py`), `tests/integration/test_git_mirror.py`
**Acceptance criteria**
- Workspaces are populated by file transfer from the mirror; no git command runs inside a Sandbox and no credential enters one.
- Patches are extracted host-side; commits carry the required trailers (FR-044).
- A workspace is reconstructible from base commit plus ordered patch artifacts.

### GIT-02 — Delivery: branch push and pull request
**Role:** platform · **Blocked by:** GIT-01, APPR-01, ORCH-09 · **Blocks:** M6
**Reading:** [02-architecture/14-integrations.md](../02-architecture/14-integrations.md), [01-product/03-functional-requirements.md](../01-product/03-functional-requirements.md) (FR-031, FR-032)
**Touches:** `made/git/delivery.py`, `made/git/hosts/**`, `tests/integration/test_delivery.py`
**Acceptance criteria**
- No push occurs without a recorded approval, and no push to the default branch is possible even when explicitly requested (FR-031).
- Push or pull-request failure parks the Run with the branch retained; the Run is never reported as delivered.
- The pull request body carries the run summary, cost and attempt trail.

---

## M5 — Evaluation, hardening and first install

### EVAL-01 — Golden-task harness
**Role:** llm · **Blocked by:** LLM-02, ORCH-07 · **Blocks:** EVAL-03
**Reading:** [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)
**Touches:** `made/eval/**`, `tests/eval/conftest.py`
**Acceptance criteria**
- Runs a named configuration across all tiers with a configurable repetition count (default 3) and reports pass rate, cost, attempts, escalation rate, p95 duration, cache ratio and authority violations.
- Results are written as a machine-readable artifact (FR-077).

### EVAL-02 — Golden tasks, seed repositories and adversarial fixtures
**Role:** llm · **Blocked by:** EVAL-01 · **Blocks:** EVAL-03
**Reading:** [02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md), [04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md)
**Touches:** `tests/eval/tasks/**`, `tests/fixtures/repos/**`
**Acceptance criteria**
- 20–30 tasks across at least three repositories, covering all five tiers.
- Adversarial repositories contain injection text in a README, a test docstring and a comment; cases assert zero authority violations (FR-078, NFR-028).
- At least one unsatisfiable case asserts termination within cap and ceiling (FR-079).

### EVAL-03 — Baseline and the regression gate
**Role:** llm · **Blocked by:** EVAL-02 · **Blocks:** —
**Reading:** [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-026, NFR-027), [04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md)
**Touches:** `eval/baseline.json`, `.github/workflows/eval.yml`, `made/eval/compare.py`
**Acceptance criteria**
- `make eval-compare` reports deltas against the committed baseline.
- CI blocks a pull request touching prompts, tiers or retrieval when pass rate drops more than 2 points or mean cost per successful Run rises more than 15%, unless explicitly overridden in the pull request.

### AUDIT-01 — Audit export
**Role:** platform · **Blocked by:** API-01, PLAT-05 · **Blocks:** M6
**Reading:** [02-architecture/09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md), [`/contracts/schemas/run-event.schema.json`](../../contracts/schemas/run-event.schema.json)
**Touches:** `made/audit/export.py`, `made/api/routes/audit.py`, `tests/contract/test_audit_export.py`
**Acceptance criteria**
- Newline-delimited JSON, ascending by `seq`, conforming to the published schema (FR-065).
- Contains every execution, model call, egress decision and approval with the authorising Run, Task, Attempt and State.
- Contains no secret material, verified against the seeded-secret corpus.

### AUDIT-02 — Replay corpus and crash matrix
**Role:** platform · **Blocked by:** PLAT-05, ORCH-07 · **Blocks:** —
**Reading:** [02-architecture/09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md), [04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md)
**Touches:** `tests/replay/**`, `tests/fixtures/events/**`
**Acceptance criteria**
- At least 20 recorded real Runs including at least 5 failures, committed as fixtures.
- Fold reproduces State and spend exactly for all of them (NFR-016).
- Crash injection at every non-terminal State reaches a terminal State with zero duplicated charges (NFR-019).

### OPS-01 — Invariant queries and nightly reconciliation
**Role:** infra · **Blocked by:** PLAT-05, LEDG-01 · **Blocks:** M6
**Reading:** [02-architecture/02-data-model.md](../02-architecture/02-data-model.md) (invariants), [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)
**Touches:** `made/store/invariants.py`, `.github/workflows/nightly.yml`, `tests/integration/test_invariants.py`
**Acceptance criteria**
- INV-1 through INV-9 implemented as SQL checks with a fixture that violates each.
- Nightly job fails and alerts on any violation; INV-2 and INV-8 map to alerts 2 and 3.

### OPS-02 — Backup and restore drill
**Role:** infra · **Blocked by:** INFRA-01, PLAT-06 · **Blocks:** M6
**Reading:** [02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), [01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md) (NFR-025)
**Touches:** `deploy/backup.sh`, `deploy/restore.sh`, `tests/integration/test_restore_drill.py`
**Acceptance criteria**
- Restore onto a clean host reproduces all Runs, events and artifacts; the audit export for a sampled Run is byte-identical.
- Retention pruning refuses to run when no backup completed in the last day.

### OPS-03 — Metrics and the alert catalogue
**Role:** infra · **Blocked by:** PLAT-05, LEDG-01 · **Blocks:** —
**Reading:** [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)
**Touches:** `made/observability/**`, `deploy/alerts.yaml`, `tests/contract/test_alert_catalogue.py`
**Acceptance criteria**
- System and domain metrics exposed in Prometheus text format, including cost per successful and per failed Run reported separately.
- Exactly the eight alerts from the catalogue; a contract test fails on a ninth (NFR-022).
- The system runs correctly with no metrics scraper present.

### DOC-01 — Operator runbook
**Role:** spec · **Blocked by:** INFRA-02, OPS-01, OPS-02 · **Blocks:** M6
**Reading:** [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md), [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md) (incident response), [04-engineering/02-local-dev-setup.md](../04-engineering/02-local-dev-setup.md)
**Touches:** `docs/06-operations/**`
**Acceptance criteria**
- One page per alert, each naming the check to run and the action to take.
- Incident-response procedure with the containment sequence and the blast-radius query.
- Upgrade, rollback and retention-pruning procedures.

---

## Open questions

Every **unresolved** open question marked inline in the specification appears here with what it blocks.
An agent that encounters one MUST NOT invent an answer: stop and report per
[`/AGENTS.md`](../../AGENTS.md).

Resolved questions stay in the table, struck through, with the decision that closed them. The
identifier is never reused. Keeping the row is deliberate: an agent finding a reference to `OQ-03` in
an older document needs to learn that it was answered and where, rather than concluding the table is
incomplete.

> **Twelve of these are new.** The 2026-09 vision change created more open questions than it closed,
> which is the correct state for a product whose vision changed three weeks ago. A rewrite that closed
> them all would have closed them by invention.
>
> **Five of them are interview questions**, in the sense that only the founder can answer them and no
> amount of building will: **OQ-01** (which deployment ships first), **OQ-11** (the first worksite),
> **OQ-12** (the first advisory capability), **OQ-16** (the role list) and **OQ-15** (whether the
> perimeter argument still leads). These are the ones that decide sequencing, and they are why the
> roadmap declines to assert an order within the M3 family
> ([01-roadmap.md](01-roadmap.md#what-this-ordering-does-not-claim)).
>
> **Two are answerable by measurement the system itself produces**, which is deliberate: **OQ-19** is
> answered by the recorded frequency of `requires_generated_plan` declines, and **NFR-040**'s worksite
> cycle count by the first worksite's own history. Building the instrument before answering the
> question is cheaper than guessing.

| ID | Question | Blocks | Resolved by |
| --- | --- | --- | --- |
| **OQ-01** | Which deployment shape does **v1 target first**: hosted by us, or self-hosted by the customer? Both are supported ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) and the architecture must not assume either; building and supporting both at once is not affordable for one maintainer ([00-context/02](../00-context/02-ecosystem-and-stakeholders.md)) | **M6's exit criteria** (both sets are written because assuming one would be inventing the answer), the ordering of the M3 family, OQ-14, OQ-18 and OQ-23, and whether OQ-06 is on the critical path. Does **not** block the schema — tenancy is enforced in both | Founder naming which shape the first paying deployment is |
| **OQ-02** | What compliance, retention and data-residency obligations do the first customers have? ([02-architecture/09](../02-architecture/09-audit-and-replay.md), [02-architecture/13](../02-architecture/13-security-and-compliance.md)) | The default retention value and any compliance claim in customer material. Blocks no implementation item | Founder confirming the first design partner's requirements |
| ~~**OQ-03**~~ | ~~Existing repository or greenfield?~~ | — | **RESOLVED 2026-08-14** by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): existing repositories, and specifically maintenance work in declared work classes. Greenfield out of scope; [ADR-0019](../03-adr/0019-specification-first-projects.md) withdrawn |
| **OQ-09** | How does a `dependency_upgrade` Run obtain the new package version, given that Sandboxes have no network? ([01-product/05](../01-product/05-work-classes.md)) | **Blocks WORK-02**, and therefore the first sellable capability. The most important open question in the specification | Measuring image rebuild time for a real repository against the [NFR-001](../01-product/04-non-functional-requirements.md) Sandbox budget, then choosing between a per-candidate image rebuild and a pre-populated package cache. Do **not** solve it by giving the Sandbox network access |
| **OQ-04** | Infrastructure budget ceiling, and does GPU hardware for local inference already exist? ([00-context/04](../00-context/04-business-model.md), [02-architecture/11](../02-architecture/11-infrastructure-and-devops.md)) | Default tier configuration and how often the evaluation harness can run. Soft-blocks EVAL-03's baseline economics | Founder stating available VRAM and monthly infrastructure ceiling |
| **OQ-05** | Which model and endpoint serves each capability tier, at what price? ([00-context/02](../00-context/02-ecosystem-and-stakeholders.md), [02-architecture/10](../02-architecture/10-llm-integration-and-evaluation.md)) | The shipped example configuration and any published cost-per-run figure. Does not block implementation — tiers are configuration | Running EVAL-01 against two candidates per tier and recording measured pass rate and cost |
| **OQ-06** | Pricing structure and price point ([00-context/04](../00-context/04-business-model.md)) | Any billing surface and any unit-economics claim. Blocks no v1 item, deliberately | Two design-partner conversations establishing the budget line and the comparison |
| **OQ-07** | Can the Architect reliably generate a valid scoped verification command, or must the Project declare templates per Task kind? ([02-architecture/06](../02-architecture/06-verification-and-truthfulness.md)) | **Constrains ORCH-06 and AGENT-02.** Both implement the Project-declared template as the required path and the generated command behind a default-off flag until resolved | Attempting plan generation against three real repositories with different test runners and recording validity rate |
| **OQ-08** | What is the supported host matrix, and does the isolation runtime work under an unprivileged Proxmox LXC guest? ([02-architecture/11](../02-architecture/11-infrastructure-and-devops.md)) | **Blocks INFRA-02** and therefore a self-hosted M6. Must be settled before a design-partner install, because otherwise the isolation claim is untested on the customer's real platform | Running SBX-04 on a Proxmox LXC guest and a Proxmox VM guest and recording which passes |
| **OQ-10** | Does the strong-isolation requirement **survive as specified**, relax to containers, or defer? The current boundary is a non-host kernel ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)) chosen against hostile-input and untrusted-code threat models, and both still hold. **ADR-0005's own revisit trigger has already fired** — it named "the deployment becomes multi-tenant or hosted by us" and [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) met it — so this is a scheduled question arriving rather than a new one. **Multi-tenant hosting raises the stakes rather than lowering them**: the same boundary now separates customers from each other, and a Sentry vulnerability compromises every tenant on the host ([02-architecture/18](../02-architecture/18-deployment-and-tenancy.md)) | **Blocks a hosted M6**, and therefore part of OQ-01's answer space. Moves Seam 1's trigger. Does **not** block any self-hosted milestone | Founder deciding whether hosted tenants run on the current boundary, on hardware isolation, or on dedicated per-tenant hosts. **The option that does not exist is weakening the boundary to make hosting affordable** — if it is insufficient, hosted operation is suspended |
| **OQ-11** | Which single work class should the **first worksite** support end to end? A **lint-rule sweep** has the cleanest progress command and the most trivially independent slices, so it proves the machinery fastest and impresses least; an **API migration** has slices that genuinely interact, which is where the design either works or does not; a **language conversion** — the founder's JavaScript-to-TypeScript example — is what a buyer wants and has the most conflict-prone slices ([01-product/07](../01-product/07-worksites.md)) | **Blocks WS-01 to WS-04** and therefore M3d. Determines the slice rule that gets built and the seed repository the integration suite needs | Founder naming one |
| **OQ-12** | Which advisory capability ships **first**: pull-request review, TODO triage, or the chat front door? **Review** exercises the evidence requirement hardest and is what proves the lane is not a comment generator, but its acceptance rate is unmeasurable for weeks. **TODO triage** is cheapest and easiest to evaluate, and nobody buys it. **The chat front door** reaches a new user and is by far the largest — inbound surface, outbound egress, an entitlement system, a new adversary — and its value depends on OQ-19 ([01-product/08](../01-product/08-chat-front-door.md)) | **Orders M3e against M3g**, and determines which integration surface is built first | Founder naming one |
| **OQ-13** | What scale does v1 target: **one repository, or many repositories across many teams**? The architecture supports many — tenancy, teams, per-repository budgets and worksites spanning repositories are all specified — but the tested envelope, the seed fixtures and the concurrency defaults differ, and so does whether tenant fairness matters in the first deployment ([02-architecture/01](../02-architecture/01-system-overview.md#scale-envelope)) | The scale envelope's tested range, default concurrency caps, and whether the queue-fairness weak point ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) is a v1 problem or a later one. Blocks no item; every capability works at either scale | Founder stating the first deployment's repository and team count |
| **OQ-14** | Does a **hosted** deployment offer a managed model endpoint as its default, and if so how is [FR-046](../01-product/03-functional-requirements.md)'s no-default-model rule honoured? Requiring every tenant to supply their own endpoint is a strange product; supplying one is a built-in default by another name and makes model cost ours ([02-architecture/10](../02-architecture/10-llm-integration-and-evaluation.md)) | Hosted onboarding, the tenant configuration record, and the hosted margin model. **Does not reopen pluggability**, which [ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md) settled — a customer's own endpoint is supported by construction | Founder deciding, after OQ-01 |
| **OQ-15** | Does the **security-perimeter argument** — "your source never leaves your infrastructure" — remain the **primary** selling point, become **secondary**, or get **dropped**? The previous positioning was built entirely on it, and a hosted multi-tenant service cannot make it at all ([00-context/02](../00-context/02-ecosystem-and-stakeholders.md)) | The emphasis of [00-context/01](../00-context/01-problem-and-vision.md), how much depth [02-architecture/13](../02-architecture/13-security-and-compliance.md) carries relative to the effectiveness dashboard, and whether the isolation boundary is still the first milestone. **Blocks no engineering decision** — the boundary is required by UF-1 regardless of whether it is what we sell on | Founder stating it, ideally after the first three sales conversations rather than before |
| **OQ-16** | The **role list** the founder actually wants. The set in [02-architecture/16](../02-architecture/16-agent-role-model.md) is derived from what the architecture needs, and the founder's phrasing — "architecture, deterministic execution, testing, development, review, and others to be defined" — maps onto it with two mismatches: **deterministic execution** is the Executor and is code rather than a role, and **architecture** is the Architect, which is deferred (OQ-19) | The prompt directory layout, the tool-authority table in the state-machine contract, and the golden-suite case set. Blocks nothing if the answer is the existing list, which is why the model was specified rather than waited for | Founder naming the roles and, for each, what it may do that no existing role may |
| **OQ-17** | Should a worksite be a reusable **template** applicable to a new repository? A template implies the progress command and the slice rule generalise across repositories, and nobody has checked whether they do ([01-product/07](../01-product/07-worksites.md)) | Whether worksite configuration is a per-worksite row or a declaration with instances — **a schema decision, so it should not be made twice** (CON-03) | Founder stating whether the intended use is one campaign per repository or one declaration across an estate |
| **OQ-18** | What does the **console** contain in its first version versus later? The page set in [01-product/09](../01-product/09-web-interface-and-admin-console.md) is the whole; the first version cannot be all of it. Some is forced by other choices — a hosted deployment needs users, teams and roles on day one — and some is genuinely optional at first, notably findings (also pull-request comments) and the dashboard (meaningless without data) | **Orders CONS-01 to CONS-03** and therefore M3f | Founder choosing, after OQ-01, because the hosted shape forces more of it |
| **OQ-19** | Does **generated planning return to the critical path** so that the chat front door can serve requests no work class covers? **This is the largest open question in the specification and the one genuine contradiction the vision change created.** [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) deferred the Architect and required zero model calls in `SPEC` or `PLAN`; a free-text request from a non-developer is precisely the input the Architect was specified for ([01-product/08](../01-product/08-chat-front-door.md), [02-architecture/15](../02-architecture/15-future-phase-seams.md) Seam 4) | Whether US-004, US-005, US-006 and US-008 come back; whether OQ-07 returns to the critical path; the Architect's items (AGENT-02); M4's status; and **what the front door can honestly be described as** — until it is answered, "ask for a declared kind of maintenance in plain language", not "describe any change" | Founder deciding, **informed by the recorded frequency of `requires_generated_plan` declines** — which is why that reason code exists and is indexed before the question is answered |
| **OQ-20** | May an **approval be given from a chat platform**? The constraint is not negotiable: an approval must be attributable to a principal and bound to the artifact digests that principal saw ([ADR-0011](../03-adr/0011-durable-human-approval-gates.md)). Whether a chat interaction can satisfy that is undesigned ([01-product/08](../01-product/08-chat-front-door.md)) | **Nothing** — v1 posts a link and the decision is taken in the console or the API | Founder saying whether the convenience is worth designing for, **and** a design meeting the binding requirement |
| **OQ-21** | **How do retention and long-lived entities coexist?** Retention defaults to 90 days for events and artifacts ([02-architecture/09](../02-architecture/09-audit-and-replay.md)), and the vision change created two things that outlive it: a **worksite**, whose burn-down *is* its event history and which may run for months; and the **effectiveness dashboard**, whose measures are computed from the event logs over a window ([FR-131](../01-product/03-functional-requirements.md)) and therefore cannot report a window longer than retention. Pruning a running worksite's early cycles destroys the campaign's own record; exempting it makes retention conditional on entity type, which the current deletion job does not model. **This was noticed while writing the rewrite and is not covered by OQ-02**, which is about compliance obligations rather than this functional conflict | The default retention value, the retention job's design, and the maximum window the dashboard can honestly offer. Also the replay corpus's growth, since worksite fixtures are large | Founder deciding whether retention is per entity type, whether an active worksite is exempt, and what reporting window a buyer expects — plus OQ-02's compliance answer, which sets the floor |
| **OQ-22** | Which **chat platform** is supported first: Slack, Microsoft Teams or Discord? The founder named all three; they differ in permission model, in whether inbound connectivity is required, and in how much of an organisation's access control lives in channel membership. Three adapters maintained by one person is not affordable ([01-product/08](../01-product/08-chat-front-door.md)) | **Blocks CHAT-02** and the integration suite's fixtures | Founder naming the platform the first design partner actually uses |
| **OQ-23** | **Identity for the console**: local accounts or an identity provider, and does the hosted deployment require single sign-on? A hosted multi-tenant service with local passwords is a credential-storage obligation nobody wants; requiring a provider for a self-hosted install is a barrier for a customer who has none ([01-product/09](../01-product/09-web-interface-and-admin-console.md)) | **Constrains TEN-03**: implement the identity-provider path as required and local accounts as a bootstrap-only fallback until resolved (FR-146). Blocks part of the bootstrap procedure | Founder stating what the first deployment's users already have |
