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
| **Run** | One end-to-end execution of the state machine against **one** repository, in **one** lane, from a trigger to a terminal State. The unit of budgeting, auditing and human approval. Created by a person, a schedule, an ingress event or a worksite; the trigger never changes what a Run is. | `run`, `run_id`, `runs` |
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
| **Project** | A registered configuration binding a target repository to its settings (model tiers, budgets, sandbox image, enabled work classes). Long-lived; a Project has many Runs. | `project`, `projects` |
| **Work class** | A named, recurring kind of job with a fixed task template, a declared lane and a declared oracle. The unit work arrives in ([01-product/05-work-classes.md](../01-product/05-work-classes.md)). | `work_class`, `work_classes` |

## Lanes, worksites and advisory output

Added by the 2026-09 vision change ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md),
[ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md),
[ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)). These terms are as binding as the
core domain above, and the first two carry the distinction the product now rests on.

| Term | Meaning | Identifier form |
| --- | --- | --- |
| **Lane** | Which trust model a piece of work is under. Exactly two values, fixed when a work class is declared and recorded on every Run: `verified` and `advisory`. Never inferred at run time. | `lane`, values `verified` \| `advisory` |
| **Verified lane** | Work whose outcome is decided by a command declared in advance. Everything in [ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md) applies. | `lane = 'verified'` |
| **Advisory lane** | Work for which no such command exists: the agent proposes, a human decides, quality is measured statistically over time. Carries no correctness guarantee, and says so. | `lane = 'advisory'` |
| **Finding** | One item of advisory output: a located claim about the code under review, with its evidence state. The system's record; rendered to a human as a pull-request comment or a console row. | `finding`, `findings` |
| **Evidence record** | A recorded execution supporting a finding: argv, the tree it ran against, exit code, normalised output, and the Run, Task and Attempt that produced it. Proves the demonstration, never the judgement. | `evidence`, `evidence_id` |
| **Evidence state** | A finding's exactly-two-valued label: `demonstrated` (an evidence record supports it) or `unverified` (none does, and the finding says so). | `evidence_state` |
| **Worksite** | A bounded long-running campaign that converts a repository-wide objective into many Runs across one or more repositories in one tenant. The founder's *șantier*. | `worksite`, `worksite_id`, `worksites` |
| **Slice** | The unit a worksite decomposes into. One slice becomes one Run and one pull request, deliverable independently of every other slice. | `slice`, `slices` |
| **Cycle** | One pass of a worksite: survey, plan slices, create Runs, wait. Cycles are numbered from 1 and are the unit the worksite progress oracle counts. | `cycle`, `cycle_no` |
| **Progress command** | The argv vector a worksite executes on the default branch to obtain the integer count of remaining work. A worksite's oracle, one level above a Task's. | `progress_command` |
| **Work in flight** | Delivered but unmerged pull requests belonging to a worksite. Reported separately and **never** as progress. | `in_flight_count` |
| **Claim** | A worksite's exclusive hold on a path scope in one repository. Two active worksites MUST NOT hold overlapping claims. | `claim`, `claims` |

## Requests, tenancy and surfaces

| Term | Meaning | Identifier form |
| --- | --- | --- |
| **Request** | An ask that has not yet become a Run: a chat message from a requester, triaged, clarified, then brokered onto a work class or declined. Requests have their own lifecycle and their own event log ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). | `request`, `requests` |
| **Requester** | A person who asks for work through a chat platform and who need not have a git-host account. A distinct persona ([01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md)). | `requester` |
| **Entitlement** | The administered mapping from a principal to what it may invoke: tenant, team, repositories, work classes, lanes and budgets. Chat channel membership is never an entitlement. | `entitlement`, `entitlements` |
| **Tenant** | The isolation boundary between organisations. `NOT NULL` on every tenant-scoped table, in every unique constraint and index, enforced by row-level security. A self-hosted deployment has exactly one ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). | `tenant`, `tenant_id`, `tenants` |
| **Team** | A group of principals inside a tenant, and the level at which budgets and approval policy are commonly set. | `team`, `team_id`, `teams` |
| **User** | A person with an identity in the deployment. Now a first-class entity — see the banned-synonym note, which this reverses. | `user`, `user_id`, `users` |
| **Principal** | Whatever an action is attributed to: a user, a service key, or an application installation. Approvals and audit entries name a principal. | `principal`, `principal_id` |
| **Console** | The whole web surface: Runs, worksites, requests, findings, effectiveness, administration, audit ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). | `console` |
| **Run viewer** | The Run detail page inside the console. Retained as a term because it names a specific page, not the surface. | — |
| **Ingress event** | An inbound trigger recorded before anything acts on it: a pull request opened, a push, a chat message, a schedule window, a worksite cycle. Idempotent on the provider's delivery identifier. | `ingress_event`, `ingress_events` |
| **Deployment mode** | `self_hosted` or `hosted`. Configuration, never a build variant, and known only inside `made/config/`. | `deployment_mode` |

## Agent roles

Roles are prompts plus tool grants plus a model tier. They are not services, not processes, and not
persistent identities. What defines a role, what it may and may not do, and how a new one is added are
specified in [02-architecture/16-agent-role-model.md](../02-architecture/16-agent-role-model.md).

| Role | Lane | Owns | Produces |
| --- | --- | --- | --- |
| **Architect** | verified | `SPEC` and `PLAN` states | `Spec`, `TaskGraph` |
| **Developer** | verified | `IMPLEMENT` for Tasks of kind `code` | `Patch` |
| **QA** | verified | `IMPLEMENT` for Tasks of kind `test` | `Patch` containing tests |
| **DevOps** | verified | `IMPLEMENT` for Tasks of kind `iac` | `Patch` containing deployment artifacts |
| **Reviewer** | both | `REVIEW` in the verified lane; `ASSESS` in the advisory lane | `ReviewReport`; `Finding` with its evidence state |
| **Triager** | advisory | Request triage and clarification ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)) | A brokered work-class invocation, or a decline with a reason |

The Architect is **specified and deferred**
([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)); whether it returns to the
critical path is OQ-19. The role list itself is not settled — OQ-16.

Two absences are load-bearing and neither is a role.

**No role owns `VERIFY`.** Verification is executed by the orchestrator with no model in the loop. The
founder's capability list names "deterministic execution" alongside the model-driven roles; in this
architecture that actor is the **Executor**, it is code rather than an agent, and calling it a role
would imply a prompt and a model where the whole point is that there is neither.

**No role owns evidence execution.** An evidence record is produced by the same executor, on the same
terms, for the same reason.

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
| the project (meaning the customer's code) | **target repository** | `project` is a first-class entity in this system; overloading it makes queries wrong |
| cost, price, spend (as a bare number) | **usd_cost** with a currency-bearing type | Unlabelled money fields are how currency bugs happen |
| done, complete, success (as a state) | the exact State name | `DONE`, `TASK_DONE` and "verification passed" are three different facts |
| campaign, initiative, programme, epic, migration (as an entity) | **worksite** | The founder's term is *șantier*; `worksite` is its binding English form. `migration` is a work class, not the campaign that runs it |
| mode, track, pipeline, path (meaning verified vs advisory) | **lane** | `mode` was rejected as a Project field for a specific reason ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 4) and reusing the word would resurrect that confusion |
| comment, suggestion, remark, note, observation | **finding** | A comment is how a finding is *rendered* to a human. Conflating the record with its rendering makes the evidence state unqueryable |
| proof, verification (of a finding) | **evidence** | Evidence proves the demonstration, not the judgement. Calling it verification is exactly the credibility transfer [ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md) forbids |
| ask, message, thread, ticket (as an intake record) | **request** | A request is a first-class entity with a lifecycle; a message is one input to it |
| organisation, account, workspace, customer (in code) | **tenant** | The isolation boundary needs one name, and it appears in every index and policy |
| dashboard, UI, web app, frontend | **console** | One name for the surface; `run viewer` remains the name of one page inside it |

## A reversed ban

The banned-synonym table previously required **operator** or **project** instead of `user`, on the
grounds that "user" was ambiguous between the operator, the buyer and the reviewer. That ban is
**lifted**, and the reason is recorded rather than quietly dropped: with a multi-tenant deployment and
an administration console ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md),
[ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)) there are now real people with
identities, teams, roles and permissions, and a schema with no `users` table cannot express who may
approve what. The ambiguity the ban existed to prevent is instead resolved by naming the three concepts
separately: **user** (a person with an identity), **operator** (the role that runs the deployment), and
**principal** (whatever an action is attributed to, which may be neither). `customer` remains banned in
code; use `tenant`.

## Words with a precise meaning here

**Deterministic** — produces the same output for the same input, with no model call, no clock read
and no randomness. Used as a hard property, e.g. "routing is deterministic", not as a compliment.

**Advisory** — an output that informs a decision but cannot make it. The Reviewer's verdict is
advisory; the verification exit code is not. Used both of an individual output and of the lane
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)); when the distinction matters, say
*advisory lane*.

**Demonstrated** — of a finding: an evidence record exists for it. Not a synonym for *verified*, and
the two words must never be used interchangeably, because one is a claim about a command and the other
is a claim about a Task.

**Unverified** — of a finding: no evidence record exists, and the finding says so. This is the word
that appears in the interface, and it is deliberately the same word used for a Run whose verification
did not run, because the reader's conclusion is the same: nobody checked.

**Terminal** — a State with no outgoing transitions: `DONE`, `REJECTED`, `ABORTED`. A worksite's
terminal states are `COMPLETED` and `ABANDONED`; `PAUSED` is not terminal.

**Residency** — the property that the system acts without being asked, through durable ingestion,
schedules and queues. It does **not** mean a long-lived agent process, and no agent holds state between
Runs ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

**Air-gapped** — a deployment where the host has no route to the public internet, including model
endpoints. **Deferred, not supported**: chat egress, inbound ingestion and hosted operation each
require connectivity, and no design partner has asked for air-gapped operation. Recorded with its
reason in [01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md). Do not describe a
deployment as air-gapped in customer-facing material.

**Escape** — an untrusted process obtaining execution or data access outside its Sandbox boundary.
The word is reserved for this; do not use it for a Run leaving a State. Under multi-tenant hosting an
escape is a cross-tenant breach rather than a single-customer incident
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).
