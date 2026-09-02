# Future-phase seams

The strategy is staged. This document specifies exactly what to build **now** so that each later phase
is additive, and forbids building the later phase.

> **Instruction to agents: do not implement anything in the "do not build" lists below.** If a backlog
> item appears to require one, the item is wrong — stop and report per [`/AGENTS.md`](../../AGENTS.md).
> Building a seam is cheap; building the phase behind it costs the milestone and adds an untested
> surface to the threat model.

A seam is not an abstraction layer built speculatively. Each one below already earns its place today —
`SandboxProvider` exists because the escape suite needs a fake, tier routing exists because cost
control needs it. The seam is the *discipline of not leaking past it*, which is free.

> **The 2026-09 vision change closed one seam and partly reversed another.** Seam 2 (multi-tenancy) is
> **closed** — it is now v1 architecture
> ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). Seam 6's prohibition
> on outbound paths is **partly reversed** by chat egress
> ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)), with the general webhook refusal
> intact. Seam 1's trigger moved much closer, in the harder direction. Seams 3, 5 and 7 are unchanged,
> and Seam 4's prohibition is now the subject of the largest open question in the specification.
>
> **A seam being closed or reversed is a real cost, not a milestone.** Each was a prohibition that kept
> a surface out of the threat model, and each reversal moved that surface in. Both are recorded in
> place below rather than deleted.

## Seam 1 — Hardware isolation (gVisor → Firecracker)

**Build now:** `SandboxProvider` with exactly six operations
([04-execution-isolation.md](04-execution-isolation.md)). Nothing above it may reference the runtime,
containers, images-as-containers or VMs — the glossary bans those words in identifiers for this reason.
The escape suite must run against a provider chosen by configuration, not hard-wired.

**Do not build:** microVM lifecycle management, snapshot and restore, TAP networking, guest agents,
rootfs image pipelines.

**Trigger — now much closer, and in the harder direction.** Originally: a customer requiring
hardware-level isolation as a condition of purchase, or an escape-suite finding a user-space kernel
cannot address. **Hosted multi-tenancy adds a third and makes it urgent**: an escape is now a
cross-tenant breach rather than a single-customer incident, so whether the current boundary is
sufficient for multi-tenant execution is **OQ-10**
([18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)).

The direction of travel matters. This seam may now be a **precondition** of the hosted deployment shape
rather than a later phase — and the option this project does not have is weakening the boundary to make
hosting affordable. If it is insufficient, hosted operation is suspended
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), revisit trigger).

**Test that the seam holds:** a fake provider passes the same interface tests as the real one, and no
module outside `made/sandbox/` imports anything runtime-specific. Enforced by an import-boundary lint
rule ([04-engineering/01-repo-structure.md](../04-engineering/01-repo-structure.md)).

## Seam 2 — Multi-tenancy · **CLOSED**

> **Closed by [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), 2026-09-02.**
> Multi-tenancy is v1 architecture, not a future phase. The prohibition below is **lifted**, and the
> record is retained because its central argument is the constraint the implementation had to satisfy.

**What was forbidden, and what was built instead.** The prohibition was on "a `tenants` table, a
nullable `tenant_id` column, row-level security, per-tenant encryption keys, or quota fairness", on the
grounds that *a nullable tenant column creates the appearance of isolation with no enforcement, which is
worse than its absence — a reviewer sees the column and assumes a guarantee that does not exist.*

**That argument was accepted in full, and it is why the column is `NOT NULL`.** What is built is the
whole boundary: `tenant_id NOT NULL` in every unique constraint and every index serving a tenant-scoped
query, row-level security on every tenant-scoped table, and tenant resolution from the authenticated
principal rather than from any request field
([FR-140](../01-product/03-functional-requirements.md),
[FR-141](../01-product/03-functional-requirements.md),
[18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)). A half-measure was correctly rejected;
this is not one.

**The migration this seam specified no longer exists**, because tenancy is present from the first
migration. That is the entire reason the decision was taken before any row was written: adding
`tenant_id` to every unique constraint and index *after* a customer's data exists is a migration under
load, on a schema whose invariants are the product's audit story.

**Two items from the prohibition are still not built**, and both are named rather than quietly dropped:

**Per-tenant encryption keys** — not built. Row-level security and tenant prefixes are the boundary;
per-tenant keys would be a key-management system to operate and would not change the failure mode that
matters, which is a query with a missing predicate.

**Quota fairness** — **not built, and this is the honest gap.** `SELECT … FOR UPDATE SKIP LOCKED` gives
no fairness guarantee, so a tenant with a hundred queued slices and a tenant with one are
indistinguishable to it. Per-tenant concurrency caps bound the damage without eliminating it
([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)). It is the one item from the
original "a platform team running this as shared infrastructure is not a user" objection that remains
unanswered, and it is the measured trigger for reopening the message-broker decision
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

## Seam 3 — Parallel Task execution

**Build now:** the TaskGraph is already a DAG with explicit dependencies, and `TASK_SELECT` already
chooses from ready Tasks — it simply chooses one. Reducers are documented per field
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)).

**Do not build:** fan-out edges, `Send`-style dynamic dispatch, merge-conflict resolution, or parallel
Sandboxes per Task.

**What changes when triggered:** every reducer must be re-examined (only `attempts` and `guard_trips`
are append-reduced today, and that is safe *because* execution is sequential); the workspace needs a
strategy for concurrent patches, most likely a worktree per Task with a merge step; failure attribution
across concurrent Tasks needs design, because "which Task broke the suite" stops being obvious; and
budget admission must become atomic across concurrent claimants.

**Trigger:** measured Run duration dominated by sequential Task execution *and* a golden-suite pass rate
high enough that concurrency is worth the debugging cost. Not before — parallelism multiplies the
difficulty of every other failure and directly threatens
[UF-3](01-system-overview.md#the-five-unforgivable-failures) and
[UF-5](01-system-overview.md#the-five-unforgivable-failures).

> **Unchanged by the 2026-09 vision change, and the pressure on it was relieved rather than increased.**
> Worksites deliver concurrency **between** Runs — many slices, many pull requests, several campaigns —
> which is what "running several worksites in parallel" actually required
> ([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)). Tasks inside one Run still
> execute one at a time ([FR-027](../01-product/03-functional-requirements.md)).
>
> This is worth noticing rather than assuming: the obvious reading of the new vision was that parallel
> execution had to be built, and the honest answer is that the unit of parallelism the buyer wanted was
> never the Task. The concurrency problems the vision change *did* create — two campaigns touching the
> same files — are solved by exclusive path claims and by the patch applier's refusal to fuzzy-match,
> not by fan-out ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)).

## Seam 4 — Generated planning, and beyond it greenfield

**Closed for now, and the reason matters.** OQ-03 is resolved: the product is maintenance work on
existing repositories, and the unit of work is a work class with a fixed task template
([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md),
[01-product/05-work-classes.md](../01-product/05-work-classes.md)). Greenfield generation is out of
scope and [ADR-0019](../03-adr/0019-specification-first-projects.md) is withdrawn.

This seam therefore now covers the nearer thing that was deferred with it: **generated planning**. The
Architect, `SPEC`, `PLAN`, `GUARD_PLAN_VALID` and the TaskGraph contract are all fully specified, and
none of them is on the critical path to the first sellable capability, because a work class supplies
the plan.

**Build now:** nothing new. Everything the seam needs already exists as specification, and the two
items that were justified by ADR-0019 are retained because they pay for themselves in the maintenance
product — `spec-lint` as a library with a machine-readable report (`SPEC-01`), and the enforced
`touches` scope per Task ([FR-080](../01-product/03-functional-requirements.md)), which is *more*
useful here than it would have been there, since a dependency upgrade's affected paths are predictable.

**Do not build:** the Architect, `SPEC`/`PLAN` model calls, plan approval flow, a Project `mode`, a
specification phase, scaffolding, or templates. Note in particular that no `mode` column or API field
exists, deliberately — a field with one legal value implies a capability that is not there, the same
trap as the tenant column in Seam 2.

**Trigger, in order.** Generated planning becomes worth building when work classes cover the demand and
customers ask for jobs that no template fits — evidenced by requests declined for lack of a class, not
by ambition. Greenfield reopens only if a design partner asks for new projects *and* brings the oracle
question with them, at which point [ADR-0019](../03-adr/0019-specification-first-projects.md) is the
design to revive rather than reinvent.

> **The 2026-09 vision change made this seam's trigger measurable, and made the prohibition contested.**
>
> The chat front door needs exactly what this seam forbids. A non-developer's free-text message is the
> input the Architect was specified to handle, and
> [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) said v1 would not accept
> it. [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md) therefore specifies the narrow
> version — broker onto a declared work class, or decline — and records the wide version as **OQ-19**,
> the largest open question in the specification.
>
> **The prohibition stands until OQ-19 is answered, and it is now instrumented.** A request that no
> class fits is declined with reason `requires_generated_plan`
> ([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)), and the frequency of that
> reason is recorded and indexed for it ([02-data-model.md](02-data-model.md)). This turns the trigger
> above — "evidenced by requests declined for lack of a class, not by ambition" — from a principle into
> a query.
>
> **Greenfield is unaffected.** OQ-03 remains resolved and
> [ADR-0019](../03-adr/0019-specification-first-projects.md) remains withdrawn.

## Seam 5 — Model-authored image building

**Build now:** `iac` Tasks and their static validators.

**Do not build:** a build service, a registry integration, or execution of model-authored `RUN` steps.
Building a model-written Dockerfile executes arbitrary code with network access, which is a materially
larger threat model than anything in v1 ([04-execution-isolation.md](04-execution-isolation.md)).

**Trigger:** a customer requires end-to-end validation of generated deployment artifacts, and the
isolation boundary has moved to Seam 1.

## Seam 6 — Notification and SIEM egress · **PARTLY REVERSED**

> **Chat egress was built** ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). The general
> prohibition on outbound paths **stands**, and the distinction between the two is the whole content of
> this seam now.

**Build now:** the event log with a sequence cursor, and the audit export
([09-audit-and-replay.md](09-audit-and-replay.md)). Both are pull-based, which means a consumer can
already build anything they need.

**Do not build:** outbound webhooks to customer-configured URLs, or log shipping to a SIEM. Each adds
an outbound path from the control plane to a destination whose payload we must defend generically,
which is a new egress surface ([13-security-and-compliance.md](13-security-and-compliance.md)).

**What was built, and why it is not the forbidden thing.** Chat egress is a **named integration** whose
payload shape we control: one adapter per platform, a per-field posting allowlist
([FR-114](../01-product/03-functional-requirements.md)), every post recorded as an egress decision, and
the whole path disableable per deployment. It is assertable against a seeded corpus
([NFR-036](../01-product/04-non-functional-requirements.md)); a generic webhook is not.

**The line to hold:** if chat egress ever grows a configurable destination URL, an arbitrary payload,
or a "notify on any event" affordance, **this refusal has been broken rather than qualified.** That
sentence is the seam.

**Trigger for the rest:** a customer requiring push delivery into their SIEM as a purchase condition.
Note that the chat adapter is not the design to generalise from — its safety comes from a fixed payload,
which is exactly what a SIEM feed cannot have.

## Seam 7 — Cross-Run learning

**Build now:** attempt records within a Run, and the evaluation corpus, which is where genuine learning
accumulates — in tests, not in a hidden store.

**Do not build:** a semantic memory of past solutions, a vector store of prior fixes, or automatic
prompt evolution. Any of these injects an unlogged influence into a Run, which breaks the property that
a Run is explainable from its own event log
([09-audit-and-replay.md](09-audit-and-replay.md)) — and explainability is a v1 gate, not a nice-to-have.

**Trigger:** a design in which retrieved prior knowledge enters the Run as a **logged artifact with a
digest**, so that "why did it do that" remains answerable. That design does not exist yet, and the
absence of it is the reason for the prohibition, not squeamishness about the idea.

> **Survived the 2026-09 vision change, and it was the closest call in the whole revision.** Two things
> pushed hard against it.
>
> **Worksites** carry state across weeks and dozens of cycles. They do it with **rows and an
> append-only event log** rather than a model's carried context — every measured count, every slice
> plan, every cycle outcome is a record with a digest
> ([FR-101](../01-product/03-functional-requirements.md),
> [01-product/07-worksites.md](../01-product/07-worksites.md)). That is precisely the shape the trigger
> above asks for, and it is why campaigns could be added without reopening this prohibition.
>
> **"A swarm of agents that lives inside your infrastructure"** is, read literally, a request for
> exactly what this seam forbids: resident agents accumulating familiarity with a codebase. That
> reading was **refused**, and the refusal is recorded with its cost rather than defined away — the
> quality gains a context-carrying agent might deliver are not available under this decision, and if
> they turn out to be large, this seam is what is in the way
> ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).
>
> **Still forbidden, restated because the vocabulary changed around it:** a semantic memory of past
> solutions, a vector store of prior fixes, automatic prompt evolution, an `agent_memory` or
> `prior_solution` table ([02-data-model.md](02-data-model.md)), and any worksite-level or
> tenant-level store of conclusions.

## Summary

| Seam | Status | Build now | Forbidden | Trigger |
| --- | --- | --- | --- | --- |
| 1 Hardware isolation | Open, **trigger much closer** | Six-operation provider interface, configurable | microVM lifecycle, snapshots | Customer requirement, escape finding, **or OQ-10 deciding the current boundary is insufficient for multi-tenant execution** |
| 2 Multi-tenancy | **CLOSED** — now v1 architecture | `tenant_id NOT NULL`, row-level security, tenant from the principal | Per-tenant encryption keys; **quota fairness remains unbuilt and is the honest gap** | — ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) |
| 3 Parallel Tasks | Open, **pressure relieved** | DAG with dependencies, documented reducers | Fan-out, dynamic dispatch, merge-conflict resolution | Duration dominated by sequencing, at a high pass rate. Worksites supplied the concurrency actually wanted |
| 4 Generated planning, then greenfield | Open, **contested and instrumented** | Nothing new; `spec-lint` library and `touches` retained | The Architect, `SPEC`/`PLAN` calls, plan approval, Project `mode`, specification phase, scaffolding | **OQ-19**, measured by the frequency of `requires_generated_plan` declines |
| 5 Image building | Open, unchanged | `iac` static validators | Build service, registry push | Customer requirement plus Seam 1 |
| 6 Notification egress | **PARTLY REVERSED** | Pull-based log and export; one named chat adapter with a fixed payload allowlist | Webhooks to customer URLs, SIEM push, configurable destinations or payloads | Customer purchase condition. The chat adapter is **not** the design to generalise from |
| 7 Cross-Run learning | Open, **closest call in the revision** | Attempt records, eval corpus, worksite rows and event log | Semantic memory, vector store of fixes, prompt evolution, any store of conclusions | A logged-artifact design. Worksites already met that bar; resident agents did not |
