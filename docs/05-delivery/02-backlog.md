# Backlog — the work queue

This is the queue. Take the highest item whose dependencies are met and whose **Touches** do not
overlap anything in flight ([04-engineering/05-git-and-review-workflow.md](../04-engineering/05-git-and-review-workflow.md)).

**Reading** is exhaustive, not indicative. Read those documents and no others; context spent elsewhere
is context unavailable for the work. **Touches** is a contract with the other agents: if the work
requires a path outside it, stop and report rather than widening.

Contract changes land alone and first. Items marked **contract-only** modify
[`/contracts/`](../../contracts/) and nothing else; their consumers are separate items.

Roles map to directories and are defined in [`/AGENTS.md`](../../AGENTS.md).

---

## M0 — Foundations and contracts

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
**Reading:** [03-adr/0016-server-rendered-run-viewer.md](../03-adr/0016-server-rendered-run-viewer.md), [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md), [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)
**Touches:** `made/api/templates/**`, `made/api/views.py`, `tests/integration/test_viewer.py`
**Acceptance criteria**
- Run list and detail with event timeline, per-step cost, Tasks with verification results, artifacts, and spend against ceiling (FR-067).
- Truthfulness rules asserted by tests: the three verification words; a parked Run shown as waiting with its reason and never as a spinner; unknown rendered as "unknown" and never as zero.

---

## M4 — Multi-agent and delivery

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

Every open question marked inline in the specification appears here with what it blocks. An agent that
encounters one MUST NOT invent an answer: stop and report per [`/AGENTS.md`](../../AGENTS.md).

| ID | Question | Blocks | Resolved by |
| --- | --- | --- | --- |
| **OQ-01** | Is the first paying deployment self-hosted by the customer or hosted by us? ([00-context/02](../00-context/02-ecosystem-and-stakeholders.md)) | Billing surface, tenancy columns, whether Seam 2 is a v1 concern. Blocks no current item; the specification assumes self-hosted ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)) | Founder naming the deployment shape of the first design-partner install |
| **OQ-02** | What compliance, retention and data-residency obligations do the first customers have? ([02-architecture/09](../02-architecture/09-audit-and-replay.md), [02-architecture/13](../02-architecture/13-security-and-compliance.md)) | The default retention value and any compliance claim in customer material. Blocks no implementation item | Founder confirming the first design partner's requirements |
| **OQ-03** | Does v1 change an existing repository, or generate a new project from a description? ([01-product/01](../01-product/01-scope-and-personas.md)) | The persona set, Project registration, the Architect prompt, Seam 4. Would invalidate AGENT-02 and parts of ORCH-06 if answered "greenfield" | Founder confirming what the first design partner wants. The oracle mechanism that used to be missing now has a candidate design in [ADR-0019](../03-adr/0019-specification-first-projects.md) (`Proposed`), so this is now a product decision rather than an open technical one |
| **OQ-04** | Infrastructure budget ceiling, and does GPU hardware for local inference already exist? ([00-context/04](../00-context/04-business-model.md), [02-architecture/11](../02-architecture/11-infrastructure-and-devops.md)) | Default tier configuration and how often the evaluation harness can run. Soft-blocks EVAL-03's baseline economics | Founder stating available VRAM and monthly infrastructure ceiling |
| **OQ-05** | Which model and endpoint serves each capability tier, at what price? ([00-context/02](../00-context/02-ecosystem-and-stakeholders.md), [02-architecture/10](../02-architecture/10-llm-integration-and-evaluation.md)) | The shipped example configuration and any published cost-per-run figure. Does not block implementation — tiers are configuration | Running EVAL-01 against two candidates per tier and recording measured pass rate and cost |
| **OQ-06** | Pricing structure and price point ([00-context/04](../00-context/04-business-model.md)) | Any billing surface and any unit-economics claim. Blocks no v1 item, deliberately | Two design-partner conversations establishing the budget line and the comparison |
| **OQ-07** | Can the Architect reliably generate a valid scoped verification command, or must the Project declare templates per Task kind? ([02-architecture/06](../02-architecture/06-verification-and-truthfulness.md)) | **Constrains ORCH-06 and AGENT-02.** Both implement the Project-declared template as the required path and the generated command behind a default-off flag until resolved | Attempting plan generation against three real repositories with different test runners and recording validity rate |
| **OQ-08** | What is the supported host matrix, and does the isolation runtime work under an unprivileged Proxmox LXC guest? ([02-architecture/11](../02-architecture/11-infrastructure-and-devops.md)) | **Blocks INFRA-02** and therefore M6. Must be settled before a design-partner install, because otherwise the isolation claim is untested on the customer's real platform | Running SBX-04 on a Proxmox LXC guest and a Proxmox VM guest and recording which passes |
