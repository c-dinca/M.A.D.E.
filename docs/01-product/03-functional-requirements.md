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
| `escape` | Hostile-payload isolation suite, release-blocking. Extended by the 2026-09 vision change to cover cross-tenant reachability and the repository permission envelope, because both are boundaries whose failure is a disclosure rather than a wrong answer ([04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md)) | `tests/escape/` |
| `replay` | Event-fold determinism and crash recovery, for the Run, worksite and request logs | `tests/replay/` |
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
| ~~FR-084~~ | ~~A review-only work class MUST run with a read-only toolbelt, MUST NOT produce a `Patch`, and MUST NOT be reported as verified.~~ **Withdrawn** — the read-only clause is incompatible with the evidence requirement, because writing a failing test is producing a patch. Superseded by [FR-091](#epic-k--lanes-and-advisory-output) (narrower write boundary) and [FR-086](#epic-k--lanes-and-advisory-output) (the reporting clause, retained). See [ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md). | — |
| FR-085 | Enabling a work class on a Project MUST execute that class's declared oracle against the base branch and MUST refuse if it cannot be executed, reporting the command and its output. | `int` |

## Epic I — Evaluation

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-076 | The system MUST provide a harness that runs a fixed golden-task suite against a named configuration and records pass rate, mean cost, mean attempts, escalation rate and p95 duration. | `eval` |
| FR-077 | Harness results MUST be written as a machine-readable baseline artifact that a later run can be compared against. | `eval` |
| FR-078 | The golden suite MUST include adversarial cases containing prompt-injection content in repository files, and those cases MUST assert that no unauthorised tool call occurred. | `eval` |
| FR-079 | The golden suite MUST include at least one unsatisfiable request, asserting termination in `AWAIT_HUMAN` within the attempt cap and under the budget ceiling. | `eval` |
| FR-148 | The golden suite MUST include advisory cases asserting that a finding's recorded `evidence_state` matches whether an evidence record was produced, and that no finding is emitted with neither evidence nor an `unverified` label. | `eval` |

---

# Requirements added by the 2026-09 vision change

Epics K to Q were added when the product vision changed
([00-context/06-vision-change-2026-09.md](../00-context/06-vision-change-2026-09.md)). Two conventions
apply to them and both are deliberate.

**Identifiers are not contiguous with their epic in every case.** FR-147 and FR-148 sit in earlier
epics because the surrounding blocks were allocated first, and IDs are permanent and never renumbered
([`../README.md`](../README.md#document-conventions)). Epic J is already numerically out of order
relative to Epic I for the same reason.

**None of these is implementable yet.** Every entity they describe — lane, worksite, request, finding,
evidence record, tenant, ingress event — is absent from [`/contracts/`](../../contracts/), which is
normative. The contract changes land alone and first
([05-delivery/02-backlog.md](../05-delivery/02-backlog.md)), and until they do a requirement here
describes something with no normative form. This is recorded rather than hidden
([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)).

## Epic K — Lanes and advisory output

The mechanism for [ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md) and
[ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md). FR-086, FR-087 and FR-092 together are
what stop advisory output borrowing the credibility of verified output, and they are the requirements
in this epic most likely to be weakened by an agent trying to make a summary look tidy.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-147 | Every work class MUST declare its lane, `verified` or `advisory`; the lane MUST be immutable for that class; and every Run MUST record the lane it executed in. The lane MUST NOT be derived at run time from anything an agent produced. | `unit`, `contract`, `int` |
| FR-086 | A Run in the advisory lane MUST NOT be reported as *verified*, *failed verification* or *not verified* on any surface. Those three terms are reserved for the verified lane. | `unit`, `int` |
| FR-087 | Every surface presenting output MUST make the lane visible before the content, and MUST render a verified result differently from a suggestion. | `unit`, `int` |
| FR-088 | Every finding MUST carry an `evidence_state` of exactly `demonstrated` or `unverified`. `demonstrated` MUST reference an evidence record holding the argv vector, the commit and patch digest of the tree it ran against, the exit code, the normalised output, and the authorising Run, Task and Attempt. | `unit`, `contract`, `int` |
| FR-089 | A surface presenting findings MUST render `demonstrated` and `unverified` findings differently; a `demonstrated` finding MUST lead with its command and exit code, and an `unverified` finding MUST lead with the word *unverified*. | `unit`, `int` |
| FR-090 | The count of findings by `evidence_state` MUST be recorded per Run and reported per work class. | `unit`, `int` |
| FR-091 | An advisory Run MAY write and execute only inside its own evidence workspace. It MUST NOT patch or push the branch under review, MUST NOT submit an approving pull-request review, and MUST NOT be reported as verified. **Replaces the withdrawn FR-084.** | `unit`, `int`, `escape` |
| FR-092 | No advisory output MUST be able to mark a Task successful, release an approval, close an escalation, or be counted as human acceptance. An evidence record MUST NOT be recorded as a verification event and MUST NOT satisfy INV-2. | `unit`, `int` |
| FR-093 | An advisory Run MUST be subject to budget admission before every model call, the attempt caps, the wall-clock TTL, one Sandbox per Run, and an event per effect, on the same terms as a verified Run. | `unit`, `int` |
| FR-094 | Effectiveness reporting MUST be per lane and per work class. A single acceptance rate, cost figure or intervention rate blended across lanes MUST NOT be computed or displayed. | `unit`, `int` |
| FR-149 | A finding MUST NOT be emitted with neither an evidence record nor an `unverified` label; suppressing a concern in order to omit an `unverified` finding MUST NOT be a configurable behaviour. | `unit`, `eval` |

## Epic L — Worksites

The mechanism for [ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md). A worksite is a
loop above every per-Run bound, so FR-097 and FR-098 are the two requirements in this epic that carry
[UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures).

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-095 | A worksite MUST declare a progress command as an argv vector, executable in a Sandbox against a named commit, whose output yields an integer count of remaining work. A worksite MUST NOT become active if that command cannot be executed or its output cannot be parsed as an integer, and the refusal MUST report the command, exit code and output. | `unit`, `int` |
| FR-096 | Worksite progress MUST be measured by executing the progress command against the repository's default branch. Delivered but unmerged pull requests MUST be reported as work in flight and MUST NOT be counted as progress on any surface. | `unit`, `int` |
| FR-097 | A worksite MUST declare, before becoming active, a total spend ceiling, a total Run ceiling, a wall-clock duration ceiling and a maximum number of concurrently open pull requests. Breaching any of the first three MUST pause the worksite and escalate; reaching the fourth MUST prevent new Runs in that cycle. None MUST be raisable while the worksite is active. | `unit`, `int` |
| FR-098 | If the measured remaining count has not fallen across the declared number of consecutive completed cycles, the worksite MUST pause and escalate, and the escalation MUST distinguish slice Runs that failed verification from pull requests awaiting merge. | `unit`, `int` |
| FR-099 | A worksite MUST create Runs and MUST NOT create Tasks. Each Run it creates MUST target exactly one repository and MUST be subject to every Run-level guard and ceiling unchanged. | `unit`, `int` |
| FR-100 | A worksite MUST hold an exclusive claim on its path scope in each repository. Two active worksites MUST NOT hold overlapping claims in the same repository; a blocked worksite MUST record its waiting state, the claim blocking it, and the age of the wait. | `unit`, `int` |
| FR-101 | Worksite state MUST be persisted as rows plus an append-only worksite event log, and folding that log MUST reproduce the worksite's recorded state, cycle number, measured counts and spend exactly. No worksite state MUST be carried between Runs as model context. | `unit`, `replay` |
| FR-102 | Pausing a worksite MUST prevent the creation of new Runs while allowing in-flight Runs to finish or park. Resuming MUST re-execute the progress command and re-plan the remaining slices before creating any Run. | `int` |
| FR-103 | A worksite MUST reach `COMPLETED` only when the measured remaining count meets its declared target, and MUST reach `ABANDONED` only by a recorded human decision. A worksite MUST NOT leave `PAUSED` without a recorded human decision. | `unit`, `int` |
| FR-104 | Changing a worksite's configuration MUST create a new immutable configuration version, and every Run a worksite creates MUST record the worksite configuration version it executed under. | `unit`, `int`, `replay` |
| FR-105 | A slice Run whose base commit is no longer the current default-branch head MUST be re-planned against the current head rather than delivered against a stale tree. | `int` |

## Epic M — Requests and the chat front door

The mechanism for [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md). FR-108 and FR-111 are
the two that keep the front door honest about its own limits.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-106 | An inbound chat message MUST become a `request` with its own lifecycle and its own append-only event log. A request MUST NOT be a Run, and no work MUST be executed on a request's behalf beyond its declared triage and clarification allowance. | `unit`, `contract`, `int` |
| FR-107 | Every requester identity MUST be mapped by an administrator to an entitlement naming the tenant, the team, the permitted repositories, the permitted work classes and lanes, and a per-request and per-period budget. An unmapped identity MUST NOT create a request, and MUST receive a decline naming the missing mapping. Chat platform or channel membership MUST NOT confer an entitlement. | `unit`, `int` |
| FR-108 | A request MUST be brokered onto a work class the requester is entitled to invoke, or declined with a reason from the closed reason set. A request MUST NOT be converted into a Run carrying free-text intent. | `unit`, `int` |
| FR-109 | Clarification MUST be bounded by a declared maximum number of questions and a declared TTL; exhausting either MUST decline the request with the corresponding reason. | `unit`, `int` |
| FR-110 | Triage and clarification model calls MUST pass through budget admission against the requester's per-request and per-period allowance before they are made. | `unit`, `int` |
| FR-111 | If triage cannot determine the target repository, the work class, or a required parameter after its clarification allowance, the request MUST be declined. It MUST NOT proceed on an inferred value. | `unit`, `int` |
| FR-112 | An approval MUST require a principal authenticated to the control plane and MUST record the artifact digests shown to that principal. A chat interaction MUST NOT record an approval; the broker MUST post a link instead. | `unit`, `int` |
| FR-113 | A requester MUST be able to follow their request's progress in the originating thread and through a read-only view scoped to their own entitlement, without a git-host account. A request MUST NOT grant any repository access. | `int` |
| FR-114 | Messages posted to a chat platform MUST be restricted to request state, the work class and its parameters, the terminal outcome and decline reason, cost against the requester's allowance, pull-request URLs, and finding counts by evidence state. Source code, patch content, verification output, repository paths, file names and finding bodies MUST NOT be posted. Every post MUST be recorded as an egress decision and MUST be disableable per deployment. | `unit`, `int`, `escape` |
| FR-150 | The system MUST NOT post into a chat channel or thread it was not addressed in. | `unit`, `int` |

## Epic N — Residency, ingestion and concurrency

The mechanism for [ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md).

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-115 | An agent MUST be constructed per State entry and discarded after producing its artifact. No agent process MUST outlive a Run, and no agent MUST receive state from a previous Run except as a named artifact referenced by digest. | `unit`, `int` |
| FR-116 | Every inbound trigger — pull request opened or updated, push to a default branch, chat message, schedule window, worksite cycle — MUST be recorded as an ingress event before any action is taken on it, MUST be idempotent on the provider's delivery identifier, and MUST NOT be acted on if the event cannot be recorded. | `unit`, `int`, `replay` |
| FR-117 | Every queued item MUST be a durable record carrying its position, its age, the reason it is waiting and its cause, and MUST be exposed on the console and countable as a metric. Every queue MUST be bounded, and reaching a bound MUST shed work with a recorded reason rather than growing. Human-submitted API requests MUST continue to be refused with `429` rather than queued. | `unit`, `int` |
| FR-118 | Schedules and worksite cycles MUST be persisted and MUST survive a restart. A missed window MUST be recorded as a skipped event with a reason and MUST NOT be backfilled. | `unit`, `int` |
| FR-119 | Concurrent-Run caps and spend ceilings MUST be enforced at the deployment, tenant, project and worksite levels, and admission MUST be checked at every level before a Run is created. Exhausting one tenant's capacity MUST NOT affect another tenant's. | `unit`, `int` |
| FR-120 | The deployment MUST NOT introduce a new long-running process kind. Ingestion MUST be served by the API process, and scheduling, worksite driving, chat egress and reaping MUST be handled inside the worker process. | `contract` |
| FR-121 | State that survives between Runs MUST exist only in the git repository, the append-only event logs, and versioned configuration rows. No other store of prior conclusions MUST exist. | `unit`, `contract` |

## Epic O — Repository access

The mechanism for [ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md). FR-123 is a
hard boundary with one test per prohibition; FR-125 is the fail-closed rule and is the one an agent will
be tempted to soften into a retry.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-122 | The system MUST authenticate to a git host as a dedicated application installation, or where the host offers none, a dedicated machine account, scoped per tenant. A personal access token belonging to a human MUST NOT be accepted as a repository credential in any deployment mode. | `unit`, `int` |
| FR-123 | The permission envelope MUST be enforced where git requests are constructed, not only by the granted scope. The system MAY read repository contents and metadata, create and update branches under the reserved prefix, open and update and comment on pull requests, and read diffs, review comments and check results. It MUST NOT push to a default or protected branch, force-push any ref, delete or rename any branch, create or modify a tag or release, alter branch protection or repository or organisation settings or collaborators, read or write CI or deployment secrets, merge a pull request, enable auto-merge, dismiss a review, or submit an approving review. | `unit`, `int`, `escape` |
| FR-124 | Registering a repository MUST enumerate the permissions the enabled work classes require and MUST refuse registration if any is absent, naming the permission and the class that needs it. | `int` |
| FR-125 | A missing or insufficient permission encountered at run time MUST park the Run in `AWAIT_HUMAN` with reason `access_insufficient`, naming the permission and the operation. It MUST NOT be retried, MUST NOT fall back to another credential or another ref, and MUST NOT produce a degraded delivery. | `unit`, `int` |
| FR-126 | Revocation of the system's access at the git host MUST take effect without any action on our side. On the next attempted operation the system MUST park every affected Run with reason `access_revoked`, MUST stop attempting git operations for that repository, and MUST NOT retry on a schedule. | `int` |
| FR-127 | An administrator MUST be able to disable a Project or an entire tenant, and that action MUST be recorded with its actor. | `int` |
| FR-128 | Every git operation MUST be recorded as an event carrying the operation, the ref, the identity used and the outcome. | `int`, `replay` |

## Epic P — Console, administration and effectiveness

The mechanism for [ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md). FR-131, FR-132 and
FR-139 are what make the dashboard's numbers trustworthy, and FR-137 is what stops the console
acquiring the affordances every other admin console has.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-129 | The console MUST cover Runs, worksites, requests, findings, effectiveness, budgets and alerts, approval policy, users and teams, repository access status, the queue, and audit export. Any subset shipped MUST satisfy FR-132. | `int` |
| FR-130 | The console MUST report, per lane and per work class over an explicit window: acceptance rate (pull requests merged with no human edit to the diff, over pull requests delivered), cost per merged pull request, cost per failed Run reported separately, human intervention rate, p50 and p95 time from triggering event to merge, advisory acceptance rate, evidence ratio, and worksite remaining count over time. | `int` |
| FR-131 | Every reported effectiveness figure MUST be derived from the event log by a query published with the figure. No figure MUST be computed from a rollup table, a framework checkpoint, or a value produced by a model. | `unit`, `int` |
| FR-132 | Every surface presenting an outcome MUST render: verification status as *verified*, *failed verification* or *not verified*; a Run in `AWAIT_HUMAN` as waiting for approval with its reason and never as a progress indicator; unknown values as "unknown" and never as zero; a measure with insufficient data as "insufficient data" with its count and never as a percentage; and work in flight never as progress. | `unit`, `int` |
| FR-133 | The console MUST be rendered server-side from the API process. A separate frontend build, a client-side application framework, or a second deployment artifact MUST NOT be introduced. | `contract` |
| FR-134 | Budget ceilings and alert thresholds MUST be settable per tenant, per team, per repository and per worksite, and every administrative action MUST be recorded as an event with its actor. | `int` |
| FR-135 | An approval policy MUST bind a scope, a lane and a work class to the principals permitted to approve, with a minimum approver count defaulting to one. A requester MUST NOT be permitted to approve delivery of their own request by default, and a policy that would leave a scope with no eligible approver MUST be rejected rather than saved. | `unit`, `int` |
| FR-136 | The `auditor` role MUST be able to read Runs, worksites, requests, events and exports, and MUST NOT be able to create a Run, approve anything, or change configuration. | `contract`, `int` |
| FR-137 | No console surface MUST execute anything on demand, force a state transition, mutate history, or perform a bulk approval, and the console MUST NOT have an endpoint the published API does not. | `contract`, `int` |
| FR-138 | A hosted deployment MUST NOT compute or display a figure aggregated across tenants unless every contributing tenant has enabled it, and the consent MUST be recorded. | `unit`, `int` |
| FR-139 | Every reported measure MUST carry the count it was computed from, and any projection MUST carry the number of observations it was projected from. | `unit`, `int` |

## Epic Q — Tenancy, identity and deployment mode

The mechanism for [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md). FR-140
and FR-141 are the pair that makes tenancy enforced rather than decorative; a missing tenant predicate
is a disclosure defect rather than a wrong answer, which is the class of bug tests pass through.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-140 | Every tenant-scoped table MUST carry `tenant_id NOT NULL`, MUST include it in every unique constraint and in every index serving a tenant-scoped query, and MUST have row-level security enabled. A nullable tenant column MUST NOT exist. | `contract`, `int` |
| FR-141 | The tenant MUST be resolved from the authenticated principal and MUST NOT be read from a request field, a header, or a path parameter. | `unit`, `contract`, `int` |
| FR-142 | A `self_hosted` deployment MUST run with exactly one tenant row, created by bootstrap; the API MUST NOT expose tenant creation in that mode. | `int` |
| FR-143 | No capability MUST exist in one deployment mode and not the other. The deployment mode MUST NOT be readable outside the configuration module, and behaviour MUST NOT branch on it in application code. | `unit`, `contract` |
| FR-144 | Artifact prefixes, object-store paths, metric labels and log fields carrying tenant-scoped data MUST be tenant-scoped, and a tenant's data MUST NOT be reachable through any of them without a tenant in scope. | `unit`, `int`, `escape` |
| FR-145 | Users, teams and roles MUST exist as first-class records; every principal MUST belong to exactly one tenant; and entitlements MUST be administered per principal rather than inferred from group membership on an external platform. | `contract`, `int` |
| FR-146 | A `hosted` deployment MUST authenticate console users through a configured identity provider. A `self_hosted` deployment MAY use local accounts. **Constrained by OQ-23**: until it is resolved, implement the identity-provider path as the required one and local accounts as a bootstrap-only fallback. | `int` |

## Withdrawn requirements

| ID | Withdrawn because | Superseded by |
| --- | --- | --- |
| **FR-084** | Required a review-only work class to run with a read-only toolbelt and to be incapable of producing a `Patch`. Incompatible with the review-by-evidence requirement, because writing a failing test that demonstrates a bug *is* producing a patch. The consequence is recorded rather than glossed: the advisory lane is no longer read-only and inherits every isolation gate it was previously exempt from. | [FR-091](#epic-k--lanes-and-advisory-output) for the write boundary, [FR-086](#epic-k--lanes-and-advisory-output) for the reporting clause, which is retained unchanged. [ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md) |

The original row stays in place in Epic J, struck through. The ID is retired and never reused.
