# Functional requirements

Every requirement has a permanent identifier. IDs are never reused or renumbered; a requirement that
stops applying is marked **Withdrawn** with a reason and its ID is retired. Every requirement names
the automated test that proves it — a requirement with no test is a wish, and CI treats an untested
`FR-###` as a defect ([04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md)).

Test-suite shorthand used in the **Verified by** column, defined in
[04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md):

| Shorthand | Suite | Location |
| --- | --- | --- |
| `unit` | Fast, no IO | `tests/unit/` |
| `contract` | Schema and OpenAPI conformance | `tests/contract/` |
| `int` | Integration against real Postgres and a real sandbox | `tests/integration/` |
| `escape` | Hostile-payload isolation suite, release-blocking | `tests/escape/` |
| `replay` | Event-fold determinism and crash recovery | `tests/replay/` |
| `eval` | Golden-task harness, nightly | `tests/eval/` |

## Epic A — Project configuration

A Project binds a target repository to the settings every Run inherits. The registration-time refusal
in FR-004 is the most consequential requirement in this epic: a repository with no runnable
verification command cannot be served honestly, so it is rejected rather than accepted and degraded.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-001 | The system MUST allow registering a Project with a name, a target repository URL, a default base branch, and a sandbox image reference. | `contract`, `int` |
| FR-002 | A Project MUST carry its own model tier configuration, run budget ceiling, attempt caps and wall-clock TTL, each overridable per Run within limits the Project sets. | `unit`, `int` |
| FR-003 | Repository credentials MUST be stored referenced by name in the host secret store, never inline in the Project record, and MUST never be returned by any API response. | `unit`, `contract` |
| FR-004 | Project registration MUST execute the declared baseline verification command against the base branch in a Sandbox and MUST refuse registration if it does not exit 0, reporting the command, exit code and output. | `int` |
| FR-005 | Changing a Project's configuration MUST create a new immutable configuration version, and every Run MUST record the configuration version it executed under. | `unit`, `int`, `replay` |
| FR-006 | The system MUST expose list and get operations for Projects, excluding secret material. | `contract` |
| FR-007 | Archiving a Project MUST prevent new Runs while retaining all historical Runs, events and artifacts. | `int` |
| FR-008 | A Project's sandbox image MUST be pinned by content digest, and a Project referencing a mutable tag MUST be rejected. | `unit`, `contract` |
| FR-009 | A Project MUST declare an egress allowlist for image build time; the empty list MUST be valid and MUST be the default. | `unit`, `int` |
| FR-010 | The system MUST refuse any Run whose target branch is the Project's default branch. | `unit`, `contract`, `int` |

## Epic B — Run lifecycle

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-011 | The system MUST accept a Run request carrying free-text intent, a base commit or branch, an optional budget ceiling and a client idempotency key, and MUST return a Run identifier. | `contract`, `int` |
| FR-012 | Each Run MUST operate on its own branch named `made/run-<run_id_short>` created from the declared base commit. | `int` |
| FR-013 | A Run MUST occupy exactly one State from [`/contracts/state-machine.json`](../../contracts/state-machine.json) at any time, and MUST only transition along transitions declared there. | `unit`, `replay` |
| FR-014 | The system MUST expose the current State, spend to date, task progress and terminal reason for a Run. | `contract`, `int` |
| FR-015 | The system MUST expose a Run's events in sequence order with cursor pagination. | `contract`, `int` |
| FR-016 | An operator MUST be able to cancel a non-terminal Run; cancellation MUST destroy the Sandbox, record a terminal event and leave the branch intact for inspection. | `int` |
| FR-017 | After a control-plane restart, a Run that was mid-execution MUST resume from its last durable checkpoint without repeating a model call that was already charged. | `replay`, `int` |
| FR-018 | A Run exceeding its wall-clock TTL MUST terminate in `ABORTED` with reason `ttl_expired`, and its Sandbox MUST be destroyed. | `int` |
| FR-019 | `DONE`, `REJECTED` and `ABORTED` MUST be terminal: no transition out, no further spend, no further Sandbox activity. | `unit`, `int` |
| FR-020 | Exactly one worker MUST be able to advance a given Run at a time; a second worker attempting to advance the same Run MUST fail to acquire the lease and MUST NOT execute any effect. | `int` |
| FR-021 | Submitting the same idempotency key twice for the same Project MUST return the original Run rather than creating a second one. | `contract`, `int` |

## Epic C — Planning

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-022 | In `SPEC`, the Architect MUST produce a `Spec` artifact validating against [`/contracts/schemas/artifact-spec.schema.json`](../../contracts/schemas/artifact-spec.schema.json). | `contract`, `int` |
| FR-023 | In `PLAN`, the Architect MUST produce a `TaskGraph` artifact that is a directed acyclic graph of Tasks. | `contract`, `int` |
| FR-024 | The plan validator MUST reject a `TaskGraph` in which any Task has an empty or absent `verification_command`, and the Run MUST NOT proceed to `IMPLEMENT` on a rejected graph. | `unit`, `int` |
| FR-025 | The plan validator MUST reject a `TaskGraph` containing a cycle, or more Tasks than the Project's configured maximum. | `unit` |
| FR-026 | Each Task MUST declare a `kind` of `code`, `test`, `iac` or `docs`, which determines the agent role that implements it. | `unit`, `contract` |
| FR-027 | Tasks MUST execute one at a time in a topological order of the graph; concurrent Task execution MUST NOT occur in v1. | `unit`, `int` |
| FR-028 | When plan approval is enabled for a Project, the Run MUST enter `AWAIT_HUMAN` with reason `plan_approval` after `PLAN` and MUST NOT spend on implementation until approved. | `int` |
| FR-029 | If the Architect reports unresolved ambiguity above the Project's threshold, the Run MUST enter `AWAIT_HUMAN` with reason `ambiguous_request` rather than guessing. | `unit`, `int` |
| FR-030 | A second consecutive invalid `TaskGraph` MUST route to `AWAIT_HUMAN`, not to a third planning attempt. | `unit` |

## Epic D — Implementation, verification and delivery

FR-033 and FR-034 together are the mechanism behind
[UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures). They are the two
requirements most likely to be weakened accidentally by an agent trying to make a run succeed, and
weakening them is the single worst change that can be made to this system.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-031 | The system MUST NOT push to a Project's default branch under any circumstance, including operator instruction. | `unit`, `int` |
| FR-032 | The system MUST NOT push any branch or open a pull request until a human approval for that Run is recorded. | `int` |
| FR-033 | Verification MUST execute the Task's declared `verification_command` unmodified inside a Sandbox, and its process exit code MUST be the sole determinant of pass or fail. | `unit`, `int` |
| FR-034 | No agent output MUST be able to change, override or bypass a verification result, and no agent MUST be able to modify a `verification_command` after planning. | `unit`, `int` |
| FR-035 | Patches MUST be expressed as exact-match search/replace edits; a `SEARCH` block that does not match the target file byte-exactly and uniquely MUST be rejected with a structured error naming the file and the nearest candidate location. | `unit`, `int` |
| FR-036 | The patch policy validator MUST reject patches that touch paths outside the workspace root after symlink resolution, exceed the configured size cap, or modify CI configuration, git hooks or submodule pointers. | `unit`, `escape` |
| FR-037 | After a patch applies, the system MUST run syntax, format and lint checks before spending a model call on verification, and MUST treat their failure as a failed Attempt. | `int` |
| FR-038 | Verification output MUST be normalised — absolute paths, timestamps, durations, memory addresses and random identifiers removed — before a `failure_signature` is computed from it. | `unit` |
| FR-039 | A Task MUST fail after its attempt cap is reached, and the Run MUST route to `AWAIT_HUMAN` rather than starting a further Attempt. | `unit`, `int` |
| FR-040 | A retry MUST be refused when the progress oracle finds the new Attempt produced an identical patch hash, or an identical `failure_signature` with no reduction in failing count, relative to any previous Attempt of that Task. | `unit`, `int` |
| FR-041 | A repeated `(state, task, workspace tree hash, input artifact digests)` tuple MUST be detected as a cycle and MUST route to `AWAIT_HUMAN`. | `unit` |
| FR-042 | The Reviewer's verdict MUST be advisory: it MAY route a Task back to `IMPLEMENT` or escalate to a human, and MUST NOT be able to mark a Task successful when verification did not pass. | `unit`, `int` |
| FR-043 | Before `INTEGRATE` completes, the Project's full verification suite MUST run and pass in a Sandbox; a Task-level pass MUST NOT be sufficient. | `int` |
| FR-044 | Every commit the system creates MUST carry trailers recording run id, task id, attempt number, verification command, model identifier and prompt version. | `unit`, `int` |
| FR-045 | Any surface presenting a Run's outcome MUST state whether verification passed, failed, or did not run, using those words, and MUST NOT present an unverified result as successful. | `unit`, `int` |
| FR-080 | When a Task declares a `touches` path scope, the patch policy validator MUST reject a patch modifying any path outside it, after symlink resolution. When a Task declares no scope, the workspace-wide policy in FR-036 applies unchanged. | `unit`, `escape` |

## Epic E — Models, cost and configuration

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-046 | The system MUST refuse to start if any capability tier lacks an explicitly configured model endpoint; there MUST be no built-in default model. | `unit`, `int` |
| FR-047 | Every model call MUST be routed by capability tier (`NAV`, `EDIT`, `PLAN`, `CRITIC`), and calling code MUST NOT name a model directly. | `unit` |
| FR-048 | Each tier MUST support a configured fallback endpoint used when the primary returns an availability error, and the fallback's use MUST be recorded on the call. | `unit`, `int` |
| FR-049 | Before every model call, the system MUST estimate its cost with the real tokeniser and MUST refuse the call if it would exceed the Task, Run or deployment budget. | `unit`, `int` |
| FR-050 | Every model call MUST be recorded with tokens in, cached tokens, tokens out, computed cost, latency, provider, model identifier, prompt version and an idempotency key, in the same transaction as its Run event. | `unit`, `int`, `replay` |
| FR-051 | A budget refusal MUST route the Run to `AWAIT_HUMAN` with reason `budget_exhausted` and MUST NOT raise an unhandled error or silently downgrade the model. | `unit`, `int` |
| FR-052 | Agent outputs MUST be validated against their artifact schema; a schema failure MUST be retried at most once with a repair instruction, after which the State fails. | `unit`, `int` |
| FR-053 | Prompt templates MUST be versioned, and the version MUST be recorded on every call that used them. | `unit` |

## Epic F — Sandbox

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-054 | Each Run MUST get its own Sandbox, which MUST be destroyed when the Run reaches a terminal State or exceeds an idle timeout. | `int` |
| FR-055 | Sandboxes MUST be created with the configured isolation runtime; if that runtime is unavailable the system MUST refuse to execute and MUST NOT fall back to a weaker runtime. | `unit`, `int`, `escape` |
| FR-056 | No credential, token, model API key or host environment variable MUST be present inside a Sandbox. | `escape` |
| FR-057 | Verification MUST run with networking disabled; a Sandbox MUST NOT be able to reach any network destination during verification. | `escape` |
| FR-058 | Sandboxes MUST be created with explicit CPU, memory, process-count and disk limits, and breaching a limit MUST terminate the Sandbox without affecting the host or other Runs. | `escape`, `int` |
| FR-059 | A reaper MUST destroy Sandboxes whose owning Run is terminal, cancelled, or has stopped heartbeating, within the configured idle timeout. | `int` |
| FR-060 | The digest of the sandbox image used MUST be recorded on the Run. | `unit`, `int` |
| FR-061 | Any network access required to build a sandbox image MUST happen at image build time, outside a Run, against the Project's declared allowlist, and MUST be recorded. | `int` |

## Epic G — Audit, observability and the run viewer

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-062 | Every Run event MUST be appended to an immutable log; the system MUST NOT expose any update or delete path for events. | `unit`, `int` |
| FR-063 | Every process execution inside a Sandbox and every model call MUST have a corresponding event containing the authorising Run, Task, Attempt and State. | `int`, `replay` |
| FR-064 | Folding a Run's events MUST reproduce its recorded final State and spend exactly. | `replay` |
| FR-065 | The system MUST export a Run's complete audit record as newline-delimited JSON conforming to [`/contracts/schemas/run-event.schema.json`](../../contracts/schemas/run-event.schema.json). | `contract`, `int` |
| FR-066 | Secrets and credential-shaped values MUST be redacted from logs, events, artifacts and prompts before persistence. | `unit`, `int` |
| FR-067 | The run viewer MUST show, for a Run, the event timeline, per-step cost, current State, artifacts and the verification result of each Attempt. | `int` |
| FR-068 | Every egress decision made on behalf of a Run — allowed or denied — MUST be recorded as an event. | `int`, `escape` |

## Epic H — Tools and context

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-069 | The toolbelt available to an agent MUST be constructed from the current State's declared authority in [`/contracts/state-machine.json`](../../contracts/state-machine.json); an agent MUST NOT be able to obtain a tool outside it. | `unit`, `int` |
| FR-070 | The system MUST provide `read_range`, `grep`, `list_dir`, `symbol_def`, `references`, `apply_patch` and `run_verification` tools, and MUST NOT provide a free-form shell tool to any agent. | `unit`, `contract` |
| FR-071 | Agents MUST receive a ranked repo map rather than file contents by default, and repository files MUST reach a prompt only through an explicit tool call. | `unit`, `int` |
| FR-072 | Prompt assembly MUST measure tokens with the target model's tokeniser and MUST fail rather than silently truncate when a section exceeds its budget. | `unit` |
| FR-073 | Verification output included in a prompt MUST be truncated to the configured number of failures and normalised. | `unit` |
| FR-074 | Attempt history MUST be passed to agents as compacted `AttemptRecord` artifacts, not as raw transcripts. | `unit` |
| FR-075 | All tool results MUST be presented to a model as delimited untrusted data with provenance, and MUST NOT be able to alter the agent's tool authority or the Task's verification command. | `unit`, `eval` |

## Epic J — Work classes

The unit maintenance work arrives in ([05-work-classes.md](05-work-classes.md)). These requirements are
what make the first product shippable without generated planning
([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)).

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-081 | A Project MUST be able to enable named work classes, each supplying a fixed task template; a Run created from a work class MUST reach `IMPLEMENT` without any model call in `SPEC` or `PLAN`. | `unit`, `int` |
| FR-082 | The system MUST support creating Runs on a schedule per Project and work class, and scheduled Runs MUST be subject to the same concurrency cap, budget ceilings and attempt caps as human-submitted Runs. | `int` |
| FR-083 | A `dependency_upgrade` Run MUST record the manifest change and the resolved versions, and MUST reject a patch that modifies a dependency manifest without a consistent lockfile update. | `unit`, `int` |
| FR-084 | A review-only work class MUST run with a read-only toolbelt, MUST NOT produce a `Patch`, and MUST NOT be reported as verified. | `unit`, `int` |
| FR-085 | Enabling a work class on a Project MUST execute that class's declared oracle against the base branch and MUST refuse if it cannot be executed, reporting the command and its output. | `int` |

## Epic I — Evaluation

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-076 | The system MUST provide a harness that runs a fixed golden-task suite against a named configuration and records pass rate, mean cost, mean attempts, escalation rate and p95 duration. | `eval` |
| FR-077 | Harness results MUST be written as a machine-readable baseline artifact that a later run can be compared against. | `eval` |
| FR-078 | The golden suite MUST include adversarial cases containing prompt-injection content in repository files, and those cases MUST assert that no unauthorised tool call occurred. | `eval` |
| FR-079 | The golden suite MUST include at least one unsatisfiable request, asserting termination in `AWAIT_HUMAN` within the attempt cap and under the budget ceiling. | `eval` |

## Withdrawn requirements

None yet. When a requirement is withdrawn, add a row here with the ID, the reason and the superseding
ADR, and leave the original row in place marked **Withdrawn**.
