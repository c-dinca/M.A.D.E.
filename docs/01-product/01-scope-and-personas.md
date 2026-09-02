# Scope and personas

> **Rewritten by the 2026-09 vision change.** The previous version described one capability in one
> lane. What changed, what was reversed and what is now open is in
> [00-context/06-vision-change-2026-09.md](../00-context/06-vision-change-2026-09.md). Read that first
> if a line here contradicts something you remember.

## In scope for v1

v1 is an environment in which role-specialised agents live inside a company's development
infrastructure and take over work in **two lanes**
([06-lanes.md](06-lanes.md), [ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)):

**The verified lane** — take a maintenance job against an existing repository, carry it out unattended,
prove it with a command declared in advance, and open a pull request for a human to merge. Unchanged
from the previous scope, and the unit of work is still a **work class**
([05-work-classes.md](05-work-classes.md)).

**The advisory lane** — review a human's pull request, find bugs, triage TODO debt, turn a
non-developer's chat request into declared work. Produce **evidence** rather than opinion where
possible, and say *unverified* where not
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). Carries no correctness guarantee, and
says so.

Above both: **worksites**, which are bounded campaigns spanning many Runs and possibly many
repositories ([07-worksites.md](07-worksites.md)).

Around both: a **console** with administration and an effectiveness dashboard
([09-web-interface-and-admin-console.md](09-web-interface-and-admin-console.md)), and a **chat front
door** for people with no commit access ([08-chat-front-door.md](08-chat-front-door.md)).

**Which parts of this go first is not settled, deliberately.** Six capabilities arriving at once is the
largest risk the vision change created, and it is a scope risk rather than a technical one
([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md), claim 1c).
OQ-01, OQ-11, OQ-12 and OQ-18 exist to force one deployment shape, one first worksite, one first
advisory class and one console subset rather than all of them.

| In scope | Why it is in |
| --- | --- |
| Register a target repository as a Project with its own budgets, model tiers, sandbox image and enabled work classes | Everything else is scoped by a Project; without it there is no boundary for configuration or cost |
| One artifact in two deployment modes: `self_hosted` and `hosted` multi-tenant, with `tenant_id` enforced everywhere | Both are required, and a nullable tenancy is worse than none ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) |
| Enable work classes on a Project, each with a fixed task template, a declared **lane** and a declared oracle | The unit of work; it is what lets the verified lane ship with no generated planning ([FR-081](03-functional-requirements.md)) |
| Create Runs from a work class — by a person, on a schedule, from an **ingress event**, or from a **worksite** | The work is recurring and unattended, and the system now reacts rather than waiting to be asked ([FR-082](03-functional-requirements.md), [FR-116](03-functional-requirements.md)) |
| `dependency_upgrade` as the first verified class: bump a dependency and fix what the bump breaks | Strongest available oracle, and it starts exactly where the free tools stop ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)) |
| **Worksites**: declared campaigns with a progress command, four ceilings, a campaign-level progress oracle, exclusive path claims, durable pause and resume | The unit the buyer recognises, and the largest new unbounded-spend surface, which is why it arrives with its own bounds ([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)) |
| **Advisory findings with evidence records**, an `unverified` label where none exists, and a measured evidence ratio | What separates the advisory lane from a comment generator ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)) |
| **A chat request broker**: entitlement-checked intake, bounded clarification, brokering onto a declared class or an honest decline with a reason | Reaches the person who has the problem and no commit access ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)) |
| **Durable ingestion, visible queues, durable scheduling, four-level concurrency and spend governance** | Residency without an unauditable component ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) |
| **A scoped application identity with a printable permission envelope**, verified at registration, fail-closed at run time, revocable in one action | Direct write access is only sellable if its boundary is testable ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)) |
| Developer and QA agents implementing Tasks of kind `code` and `test`; a Reviewer in both lanes; a Triager for requests | The roles the two lanes actually need ([16-agent-role-model.md](../02-architecture/16-agent-role-model.md)) |
| Enforced `touches` scope per Task | The affected paths are predictable for this work, so the scope is tight and meaningful ([FR-080](03-functional-requirements.md)) |
| Deterministic verification in an isolated Sandbox with no network, and evidence execution on the same terms | [UF-1](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) and [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Bounded retries: attempt caps, progress oracle, cycle detection, budget admission, wall-clock TTL — **and the worksite equivalents** | [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Human approval gates, with the Run durably parked while it waits, and an **approval policy** saying who may approve what | Autonomy without a gate is unsellable, and multi-tenancy means "who" is no longer obvious |
| Push a branch and open a pull request on the target repository's host, never to the default branch, never merging | The delivery surface engineers already use |
| Append-only audit log of every executed command, model call, egress decision, **ingress event and git operation**, exportable | [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Cost ledger and hard ceilings at **four levels**: deployment, tenant, project, worksite | [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| **A server-rendered console** with Runs, worksites, requests, findings, administration, budgets, approval policy, audit — and an **effectiveness dashboard** | The operator needs to see a Run; worksites and requests exist nowhere else; and the buyer needs the numbers that justify renewal ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)) |
| Golden-task evaluation harness, extended with advisory cases | Without it, every prompt and model change is a guess ([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)) |
| Deployment via Compose, on Linux with a container runtime, in at most four process **kinds** | Matches the self-hosted operator's environment, which is the more constraining of the two ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) |

## Out of scope for v1, with reasons

Each exclusion is a strategy decision. An agent that implements one of these has damaged the
product, not helped it. Anything **postponed** rather than excluded is in
[10-deferred-scope.md](10-deferred-scope.md), with its reason and its trigger.

| Excluded | Reason |
| --- | --- |
| **Greenfield project generation from a prompt** | Decided against in [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), which also withdraws the specification-phase design that would have enabled it. The verified lane needs a harness the system did not write; for a new project there is none, and nobody has asked for one. |
| **Feature development from a ticket** | The market everyone wants, and the one where the interactive tools already fit better. There is no reliable per-Task oracle for "did this implement what was meant", the work is attended, and competing there means competing on rented model quality ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). |
| **Generated planning, and therefore free-text intake** | Fully specified and deferred. A work class supplies the plan. The consequence for the new vision is that the chat front door serves declared classes only and declines the rest with a reason — this is the contradiction recorded as **OQ-19**, and it is the largest open question in the specification ([08-chat-front-door.md](08-chat-front-door.md)). |
| **Work with no runnable check, as a task** | "Improve quality", "modernise this module", "make it faster". In the verified lane these are refused. In the advisory lane they are refused as *tasks* and permitted only as findings that carry evidence or say they do not ([06-lanes.md](06-lanes.md)). |
| **A third lane, or a confidence score** | "Mostly verified" and "high confidence" are the same mistake: a gradient where a boundary is needed. A score is a model output, and a model's opinion never decides anything here ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)). |
| **Advisory output promoting itself into the verified lane** | An advisory Run that finds a fixable problem emits a finding. It does not start a Run to fix it. An agent that can promote its own output across the lane boundary has erased the boundary. |
| **Parallel Task execution inside a Run** | Concurrent patches against one workspace require merge-conflict handling and make failure attribution ambiguous, which directly attacks [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) and [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures). Worksites give concurrency **between** Runs instead, which is what was actually needed. The seam is specified so it stays additive. |
| **A cross-repository Run** | A Run operates on one repository. A worksite spanning several creates several Runs ([07-worksites.md](07-worksites.md)). |
| **Long-lived agent processes holding context** | Residency is a control-plane property. An agent whose behaviour depends on state that is in no event log makes "why did it do that" unanswerable, which is a v1 gate ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). |
| **Autonomous merge or deploy** | The system opens a pull request; a human merges. It cannot merge, enable auto-merge, or submit an approving review ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). Removing the gate removes the reason security approved the install. |
| **A human's personal access token as a repository credential** | It carries the human's privileges rather than the system's, breaks attribution on the customer's side, and makes their offboarding our outage ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). |
| **Approvals, merges or configuration changes from chat** | An approval must be attributable to a principal and bound to the digests that principal saw. The front door is intake and status (OQ-20). |
| **Proactive posting into chat channels** | The system posts into the thread it was asked in. An agent that can start conversations generates notification volume nobody can turn off. |
| **Source, patch content or verification output in a chat message** | A chat channel has loose access control and long retention. What may be posted is an allowlist ([FR-114](03-functional-requirements.md)). |
| **More than one language toolchain in the sandbox image** | Each additional toolchain multiplies image size, escape-suite surface and dependency-baking work. v1 ships Python; the image is a Project setting so a second is additive. |
| **Vector search over the repository** | Structural retrieval answers the queries that matter for code, and an index is infrastructure someone must maintain ([ADR-0009](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md)). |
| **Long-term semantic memory across Runs** | A memory that silently injects a past conclusion into a new Run is unauditable, and auditability is a v1 gate. Worksite state is rows and an event log, which is why worksites did not reopen this. |
| **A message broker** | Postgres carries the queue, and a broker outside the database cannot participate in the transaction that writes an effect with its event ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). |
| **Kubernetes** | Four process kinds, and the self-hosted operator's environment is a single host. |
| **A single-page application** | Nothing in the stated requirements needs one, and it competes for the only maintainer's attention with the isolation boundary ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). |
| **An IDE plugin or a mobile surface** | The product is a pipeline and a console, not an editor. The requester's mobile surface is their own chat client, which we do not build. |
| **Fine-tuning or hosting our own model weights** | Rented capability, not a moat ([00-context/04-business-model.md](../00-context/04-business-model.md)). |
| **Cross-tenant benchmarking, or any published cross-tenant figure** | Off by default and requires recorded per-tenant consent. None has been measured ([FR-138](03-functional-requirements.md)). |

**OQ-03 remains resolved.** v1 changes existing repositories rather than generating new projects
([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). The 2026-09 vision change
widened what the system does *to* existing repositories; it did not reopen greenfield.

The consequence worth carrying into every other document: **in the verified lane the oracle is a
command the system did not write and cannot influence.** Nothing the system produces decides whether
the system succeeded. In the advisory lane there is no such command, and the interface says so — which
is the second consequence worth carrying, because the two must never be confused
([06-lanes.md](06-lanes.md)).

## Personas

Six people matter now. Each has a different question the system must answer, and a different surface.
P1 to P4 are unchanged in identity and changed in emphasis; **P5 and P6 are new with the 2026-09
vision change**, and both change the design rather than only the feature list.

**P1 — Platform operator (the founder, initially; later a platform engineer at the customer).**
Installs and runs the system on a Linux host or Proxmox guest they administer. Comfortable with
Docker, Compose, Postgres and a terminal; not interested in babysitting a distributed system. Works
from a workstation on the same LAN or over a VPN, on a wired or reliable connection — there is no
mobile or offline use. Their question is *"is it running, what did it cost, and what broke."* They are
the reason operational simplicity is a design principle and the alert budget is capped.

**P2 — Lead developer at the buyer.** Reviews the pull requests the system opens, merges or rejects
them, reads its findings on their own pull requests, and enables or disables work classes on their
repositories. Lives in a git host's pull-request UI and a terminal. Their question is *"can I review
this like a normal pull request rather than audit it line by line."* They are the reason a Run's output
is a branch with a passing verification command and an attempt trail, not a chat transcript. Note what
changed with [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): they no longer
submit free-text requests, because the work arrives from a work class, a schedule, an ingress event or
a worksite.

They are also the person the advisory lane is aimed at, and the person it can most easily harm. A
review tool that posts opinions costs them attention and returns nothing checkable, which is why
findings must carry evidence or be labelled *unverified*
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). Their second question is *"can I check
this in seconds, or do I have to re-derive it."*

**P4 — Delivery or engineering manager (the economic buyer).** New with
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), and at an outsourcing
organisation this is the person who signs. They own maintenance commitments across many client
repositories: work that is contractually required, low-margin, hard to staff and disliked. Their
question is *"how much of this stops consuming senior hours, and what does it cost me per month."*
They never open the run viewer for pleasure. They are the reason cost per successful Run and per
**failed** Run are reported separately
([02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)), and the reason the
merge-rate-without-human-edit metric exists at all.

Their surface changed with the vision change: they now have one page, the **effectiveness dashboard**,
and it is the only page they will open ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)).
They are also the person who owns a stalled migration, which makes them the buyer of worksites — their
third question is *"how much of this migration is left, and when."* The answer is a remaining count
measured on merged state and no projection, which will not satisfy them and is the true answer
([07-worksites.md](07-worksites.md)).

**P5 — Non-developer requester.** New with
[ADR-0025](../03-adr/0025-chat-front-door-request-broker.md). A support engineer, product manager,
designer or account manager who **notices** the problem and has no commit access. They live in a chat
client and nowhere else: they do not have a git-host account, will not call an API, and will not learn
a console. Their question is *"did anyone do anything about what I asked."*

They are the reason the chat front door exists, and they are also the persona most easily lied to,
because they cannot tell whether the system understood them. That is why ambiguity is declined rather
than guessed ([FR-111](03-functional-requirements.md)), why a decline states its reason in the
originating thread, and why they get a scoped read-only view of their own request rather than nothing.
They gain **no** repository access by asking for a change
([FR-113](03-functional-requirements.md)), and they cannot approve their own request
([FR-135](03-functional-requirements.md)).

The uncomfortable part of serving them: in v1 the front door brokers onto declared work classes only,
so a genuine bug report — "the export is broken for German customers" — is declined with
`requires_generated_plan` (OQ-19). They are the persona whose expectations the narrow front door will
most obviously fail.

**P6 — Tenant administrator.** New with
[ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) and
[ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md). At a small customer this is P1 wearing
another hat; at a larger one it is a platform lead or an engineering manager. They decide who may
invoke what, against which repositories, under whose budget, and who may approve what. Their question
is *"who can spend our money and change our code, and can I see that it happened."*

This decision did not exist before, because there was one API key and one operator. It is now an
administrative surface with an audit trail, and every action on it is an event
([FR-134](03-functional-requirements.md)). They are the reason entitlements are administered rather
than inferred from chat channel membership, and the reason an approval policy that would leave a scope
with no eligible approver is rejected rather than saved.

**P3 — Security reviewer at the buyer.** Appears twice: once before installation, holding a veto, and
again whenever something looks unusual. Reads architecture documents, then the audit export. Their
question is *"what exactly did it execute, what could it reach, and can you prove it."* They are the
reason the event log is append-only and complete rather than best-effort. At an outsourcing
organisation their concern is usually contractual rather than paranoid — the client agreement forbids
sending source to a third party — which the self-hosted deployment satisfies by construction
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)) and is a materially easier conversation
than persuading a CISO.

## Explicitly not users in v1

Naming these prevents feature requests that would bend the product away from the buyer who pays.

**The non-technical founder or product manager who wants an application built from a description.**
Served by the browser prototyping category. Serving them requires greenfield generation, which v1
excludes for the reason above. Note the distinction from **P5**, who is also non-technical: P5 asks for
a change to a repository that exists and has a test suite. That is a different request with a different
oracle situation.

**The hobbyist wanting a free local agent.** Every hour spent on a friendly installer is an hour not
spent on the capabilities that unlock the buyer with a budget.

**A person who wants to converse with an agent.** The chat front door is a request broker with a
bounded clarification allowance, not a chat product
([08-chat-front-door.md](08-chat-front-door.md)). Someone who wants a dialogue is served by the
interactive tools.

**Anyone whose repository has no automated tests, for verified-lane work.** The system cannot verify
anything, so it cannot tell the truth about its output. The correct response is refusal at Project
registration ([FR-004](03-functional-requirements.md)), not degraded operation. The advisory lane is a
partial exception worth naming honestly: findings can be produced against an untested repository, but
the evidence requirement is much harder to satisfy there — a failing test needs somewhere to run — so
such a repository gets a low evidence ratio, which is the number that will say so.

> **A persona that was promoted rather than excluded.** The previous version listed "**a platform team
> running M.A.D.E. as shared infrastructure for many product teams**" as not a user, on the grounds
> that v1 "would fail them on isolation between teams, quota fairness and RBAC". They are now **P6**
> plus part of **P4**. Teams, per-team budgets, an approval policy and enforced tenancy exist
> ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). The one item from
> that objection that is **not** fully answered is quota fairness between concurrent claimants, which
> [ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md) names as genuinely hard
> and as the thing a Postgres queue table does worst.

## Persona-to-surface matrix

| Surface | P1 Operator | P2 Lead dev | P3 Security | P4 Manager | P5 Requester | P6 Admin |
| --- | --- | --- | --- | --- | --- | --- |
| HTTP control API ([`/contracts/openapi.yaml`](../../contracts/openapi.yaml)) | Primary | Via CLI | Read-only, audit | No | No | Secondary |
| CLI (`made`) | Primary | Primary | No | No | No | No |
| Console — run list and run viewer | Primary | Secondary | Secondary | No | **Own request only** | Secondary |
| Console — worksites | Primary | Secondary | No | **Primary** | No | Secondary |
| Console — findings | Secondary | Secondary | No | No | No | No |
| Console — effectiveness dashboard | Secondary | No | No | **Primary, and their only page** | No | Secondary |
| Console — budgets, approval policy, users, teams | No | No | Reviews once | Approves the budget | No | **Primary** |
| Console — queue and repository access status | **Primary** | No | No | No | No | Secondary |
| Git branch, pull request and findings on the target host | No | **Primary** | No | No | No | No |
| Chat thread | No | Secondary | No | No | **Primary, and their only surface** | No |
| Work-class configuration per Project | Primary | Primary | No | Approves the list | No | Secondary |
| Audit export (JSONL) | Secondary | No | **Primary** | No | No | Secondary |
| Configuration files and secrets | Primary | No | Reviews once | No | No | No |
| Logs, metrics, alerts | Primary | No | No | No | No | No |

Two rows carry design consequences. **P4 has one page**, which is why the effectiveness dashboard is a
requirement rather than a reporting nicety, and why cost per successful and per failed Run are never
averaged — an average of the two hides the number they are deciding on. **P5 has one surface and it is
not ours**, which is why the chat posting allowlist and the in-thread decline reason are requirements
rather than conveniences.

## Core loops the product must close

**The maintenance loop (primary, verified lane).** Schedule, person, ingress event or worksite triggers
a work class → task template instantiated with no planning model call → implement and verify against a
command declared in advance, under guards → human approves delivery → pull request → merged with no
further edit. The last clause is the metric that matters commercially.

**The honest-failure loop.** Verification fails → progress oracle decides whether another attempt can
learn anything → either one more attempt, or `AWAIT_HUMAN` carrying the attempt trail, the failure
signatures and the spend. This loop closing correctly matters more than the delivery loop, because it
is the one that distinguishes this product from the category it criticises.

**The evidence loop (advisory lane).** Ingress event on a human's pull request → findings produced →
each either demonstrated by an executed command or labelled *unverified* → rendered so the two cannot
be confused → resolved or dismissed by a human → acceptance rate and evidence ratio recorded per class.
This loop's closing condition is statistical rather than per Run, which is the structural weakness of
the lane and is stated rather than smoothed ([06-lanes.md](06-lanes.md)).

**The campaign loop (worksites).** Survey → slice → Runs → pull requests → **merges** → re-survey →
remaining count falls. It closes only when a human merges, which is why progress is measured on merged
state and why work in flight is reported separately
([07-worksites.md](07-worksites.md)). If the count does not fall across a declared number of cycles, the
worksite pauses and escalates rather than continuing.

**The request loop (chat front door).** Message → entitlement check → triage → at most a declared number
of clarifying questions → either a Run from a class the requester was entitled to invoke, or a decline
with a reason in the same thread. **A decline is a successful outcome of this loop.** The recorded
decline reasons are the instrument that says which class to build next, and the frequency of
`requires_generated_plan` is what answers OQ-19.

**The operator loop.** Install → smoke test → configure model tiers and budgets → observe cost → adjust.
If this loop takes more than an evening the product does not get adopted, which is why
[NFR-020](04-non-functional-requirements.md) puts a number on it.

**The evaluation loop.** Change a prompt or a model tier → run the golden suite → compare pass rate,
cost and escalation rate against the recorded baseline → ship or revert. Without this loop, every
improvement is anecdote. For the advisory lane this loop is weaker by construction: the golden suite can
assert that no unauthorised tool call occurred and that a finding's evidence state matches what was
produced, but it cannot assert that a finding was *worth making*.
