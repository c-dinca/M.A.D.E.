# Glossary — binding vocabulary

These terms are binding. The word in the **Term** column is the word that appears in Python
identifiers, database tables and columns, API fields, event kinds, log messages and the run viewer.
A synonym in code is a review-blocking defect, not a style preference.

The reason is specific to this project: an agent reading a log line, a database row and an API
response must be able to tell that they describe the same thing without inference. When one layer
says `job`, another says `session` and a third says `run`, an agent debugging a failed execution
builds a wrong mental model, and the resulting fix lands in the wrong place. Vocabulary drift also
breaks the audit story, because a reviewer cannot grep for a concept that has four names.

## Core domain

| Term | Meaning | Identifier form |
| --- | --- | --- |
| **Run** | One end-to-end execution of the state machine against one repository, from a request to a terminal state. The unit of budgeting, auditing and human approval. | `run`, `run_id`, `runs` |
| **Task** | One unit of work inside a Run, produced by the Architect, carrying its own verification command and budget. Runs contain Tasks; Tasks are never shared between Runs. | `task`, `task_id`, `tasks` |
| **Attempt** | One pass of Implement-then-Verify for a single Task. Attempts are numbered from 1 within a Task and are the unit the attempt cap counts. | `attempt`, `attempt_no` |
| **Artifact** | An immutable, schema-validated, content-addressed output (Spec, TaskGraph, Patch, TestReport, ReviewReport, AttemptRecord, RunSummary). The only way information moves between agents. | `artifact`, `artifact_sha256` |
| **Run event** | An append-only record of something that happened in a Run. The audit trail and the replay source. | `run_event`, `run_events` |
| **State** | A node of the state machine that a Run occupies. Always the UPPER_SNAKE names in [`/contracts/state-machine.json`](../../contracts/state-machine.json). | `state`, e.g. `IMPLEMENT` |
| **Guard** | A deterministic predicate that can refuse a transition (attempt cap, progress, cycle, budget, TTL, plan validity, patch policy). | `guard`, `GUARD_BUDGET` |
| **Verification command** | The executable oracle attached to a Task. Its exit code is the definition of that Task succeeding. Declared at planning time; never chosen by a model at verification time. | `verification_command` |
| **Oracle** | Synonym-free shorthand for the verification command's role in the design. Use in prose only; never an identifier. | — |
| **Progress oracle** | The guard that decides whether a retry is permitted, by comparing normalised failure signatures and counts across Attempts. Distinct from *oracle* above. | `GUARD_PROGRESS` |
| **Failure signature** | A stable hash of normalised verification output, used to detect that two Attempts failed identically. | `failure_signature` |
| **Patch** | A set of exact-match search/replace edits produced by an agent. Not a diff format the model invents, and not a whole file. | `patch` |
| **Workspace** | The checked-out copy of the target repository that a Run operates on, inside a Sandbox. | `workspace` |
| **Sandbox** | One isolated execution environment for model-generated code, with its own kernel boundary, lifetime and resource limits. | `sandbox`, `sandbox_sessions` |
| **Toolbelt** | The set of tools an agent may call in a given State. Constructed per State; authority is not negotiable at run time. | `toolbelt` |
| **Repo map** | The ranked, token-budgeted symbol skeleton of the target repository given to agents instead of source files. | `repo_map` |
| **Approval** | A recorded human decision that unblocks or terminates a Run waiting in `AWAIT_HUMAN`. | `approval`, `approvals` |
| **Ledger** | The record of model spend, per call, per Task, per Run. | `llm_calls`, `spent_usd` |
| **Target repository** | The customer repository a Run changes. Never called "the project" — see banned synonyms. | `target_repo` |
| **Project** | A registered configuration binding a target repository to its settings (model tiers, budgets, sandbox image). Long-lived; a Project has many Runs. | `project`, `projects` |

## Agent roles

Roles are prompts plus tool grants plus a model tier. They are not services and not processes.

| Role | Owns | Produces |
| --- | --- | --- |
| **Architect** | `SPEC` and `PLAN` states | `Spec`, `TaskGraph` |
| **Developer** | `IMPLEMENT` for Tasks of kind `code` | `Patch` |
| **QA** | `IMPLEMENT` for Tasks of kind `test` | `Patch` containing tests |
| **DevOps** | `IMPLEMENT` for Tasks of kind `iac` | `Patch` containing deployment artifacts |
| **Reviewer** | `REVIEW` | `ReviewReport` (advisory only — see [02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)) |

Note that no role owns `VERIFY`. Verification is executed by the orchestrator with no model in the
loop, and that absence is load-bearing.

## Banned synonyms

Left column MUST NOT appear in code, schemas, API fields, event kinds, or user-facing text. Use the
right column.

| Banned | Use instead | Why it is banned |
| --- | --- | --- |
| job, session, execution, workflow instance | **run** | Four names for the unit of billing and audit make the ledger unreadable |
| ticket, issue, story, subtask, todo | **task** | `issue` and `story` belong to the customer's tracker and to [01-product/02-user-stories.md](../01-product/02-user-stories.md); reusing them makes it ambiguous whose object is meant |
| iteration, retry, loop, cycle | **attempt** | `cycle` collides with `GUARD_CYCLE`, which detects a different thing |
| container, VM, box, environment | **sandbox** | The isolation technology changes in v2 ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)); naming the current implementation in the API would force a breaking rename |
| test run, check, validation, CI | **verification** | `CI` means the customer's pipeline; conflating them makes the audit log lie about what ran where |
| diff, edit, changeset, revision | **patch** | Only the search/replace format is accepted ([ADR-0008](../03-adr/0008-search-replace-patch-format.md)); "diff" invites unified-diff output |
| memory, context, history | **artifact** or **attempt record** | "Memory" implies hidden state; there is none. Everything an agent knows arrived as a named artifact |
| supervisor, manager, planner | **Architect** | The role names are fixed so prompts, metrics and the viewer agree |
| user, customer (in code) | **operator** (human running it) or **project** (the configuration) | "User" is ambiguous between the operator, the buyer and the reviewer |
| the project (meaning the customer's code) | **target repository** | `project` is a first-class entity in this system; overloading it makes queries wrong |
| cost, price, spend (as a bare number) | **usd_cost** with a currency-bearing type | Unlabelled money fields are how currency bugs happen |
| done, complete, success (as a state) | the exact State name | `DONE`, `TASK_DONE` and "verification passed" are three different facts |

## Words with a precise meaning here

**Deterministic** — produces the same output for the same input, with no model call, no clock read
and no randomness. Used as a hard property, e.g. "routing is deterministic", not as a compliment.

**Advisory** — an output that informs a decision but cannot make it. The Reviewer's verdict is
advisory; the verification exit code is not.

**Terminal** — a State with no outgoing transitions: `DONE`, `REJECTED`, `ABORTED`.

**Air-gapped** — a deployment where the host has no route to the public internet, including model
endpoints. A supported configuration, not a failure mode.

**Escape** — an untrusted process obtaining execution or data access outside its Sandbox boundary.
The word is reserved for this; do not use it for a Run leaving a State.
