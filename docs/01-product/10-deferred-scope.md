# Deferred scope

Nothing in this document is rejected. Each entry is something the specification previously required, or
something the new vision needs and does not yet have, that has been **postponed with a reason and a
trigger**. It is separated from the non-goals in
[00-context/01-problem-and-vision.md](../00-context/01-problem-and-vision.md#non-goals) — those are
excluded by strategy — and from the out-of-scope table in
[01-scope-and-personas.md](01-scope-and-personas.md), which lists what v1 does not do.

The distinction matters practically. An agent encountering a non-goal should refuse it. An agent
encountering something here should refuse it *and* know that the founder may want it back, so the seam
it would need is worth not breaking.

Anything postponed behind a **seam** — a specific piece of v1 work that keeps a later phase additive —
is in [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) instead. This document is
for scope; that one is for the discipline of not leaking past it.

## Deferred by the 2026-09 vision change

### Air-gapped operation

**Was:** a supported first-class configuration. The glossary defined it, ADR-0006 and ADR-0012 were
partly justified by it, and [00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md)
promised that "in a deployment configured with only local model endpoints, no source-derived byte leaves
the customer's network".

**Now:** deferred. Chat egress, inbound event ingestion and hosted operation each require connectivity,
and no design partner has asked for air-gapped operation. **Do not describe a deployment as air-gapped
in customer-facing material.**

**What survives, and it is most of the value:** a deployment can still be configured so that source
reaches nothing but the customer's own model endpoint. There is still no telemetry, no crash reporting
and no usage analytics in the default install. The model layer is still an abstraction with no default
endpoint ([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)), and verification still
runs with no network at all ([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md)). What is
gone is the claim that the *whole host* can have no route out.

**Trigger:** a customer requires it as a purchase condition. Restoring it means: chat integration off,
inbound ingestion replaced by nothing (there is no event source), self-hosted only, and a documented
statement of which capabilities are unavailable. It is a configuration profile plus an honest feature
matrix, not new architecture.

### The regulated-enterprise design-partner motion

**Was:** the whole go-to-market. The buyer was an organisation whose security function held a veto, the
first milestone was the isolation boundary because that veto turned on it, and the primary selling
point was that source never leaves the perimeter.

**Now:** deferred as *the* motion, retained as *a* motion. The new framing is broader, and a hosted
multi-tenant deployment cannot make the perimeter argument at all. Whether the argument remains primary,
becomes secondary, or is dropped is **OQ-15**.

**What survives:** every engineering control. The isolation boundary is required by
[UF-1](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) regardless of whether it
is what we sell on, and multi-tenant hosting raises the requirement rather than lowering it (OQ-10).
[13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md) is still written to be
handed to a security reviewer.

**Trigger:** OQ-15 answered in favour of keeping it primary, or a design partner in that category.

### The strictest isolation requirements as an unconditional v1 gate

**Was:** unambiguous. gVisor, fail-closed, no network during verification, no credentials, 100% escape
suite, and a full-VM-or-nothing posture on the host matrix.

**Now:** the *requirements* are unchanged and the *sufficiency question is reopened*, in the harder
direction. [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) makes an escape
a cross-tenant breach rather than a single-customer incident, so **OQ-10** asks whether a user-space
kernel is adequate for multi-tenant execution or whether hardware isolation becomes a precondition of
the hosted shape.

**Nothing here is relaxed.** No control is deferred. What is deferred is the *answer*, and the direction
of travel is toward a stronger boundary, not a weaker one. Seam 1 in
[15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) is the mechanism, and its
trigger is now much closer than it was.

### The four-processes-and-one-operator framing

**Was:** ADR-0013's central operational claim, with the process count and alert count as numbered gates.

**Now:** the *gates* survive and the *framing* has changed. NFR-021 is reinterpreted to count process
**kinds** rather than processes, so replicating `api` or `worker` is not a breach
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). That is a loosening and
it is recorded as one. The eight-alert ceiling ([NFR-022](04-non-functional-requirements.md)) is
unchanged, and ingestion needs one of the eight slots, which means something has to be removed to make
room.

**Trigger:** none. This is not deferred work; it is a reinterpretation, recorded here so that a reader
who remembers the old wording knows it moved.

## Deferred within the new vision

These are parts of the new vision that are specified but not built first. They are here rather than in
the seams document because they are product scope rather than architectural discipline.

### Generated planning, and therefore the wide chat front door

**Status:** deferred by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md),
partly revived as a question by [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md).

The Architect, `SPEC`, `PLAN`, `GUARD_PLAN_VALID` and plan approval are fully specified and not on the
critical path. The consequence for the new vision is that the chat front door serves **declared work
classes only**, and a request that fits none is declined with reason `requires_generated_plan`
([08-chat-front-door.md](08-chat-front-door.md)).

**Trigger:** **OQ-19**, informed by the recorded frequency of that decline reason. The stories parked
with the Architect — US-004, US-005, US-006, US-008 — come back with it.

### Worksite templates

**Status:** **OQ-17**. A worksite is currently one campaign against one declared scope. Applying a
declared worksite to a new repository is the obvious next capability and is not assumed, because a
template implies the progress command and the slice rule generalise across repositories and nobody has
checked whether they do.

**Trigger:** OQ-17 answered, and a second repository where the same worksite declaration is wanted
unchanged. Note that this is a **schema** question, so it should not be decided twice
([07-worksites.md](07-worksites.md)).

### Chat platforms beyond the first

**Status:** **OQ-22**. Three platforms means three APIs, three permission models and three sets of
breaking changes maintained by one person.

**Trigger:** the first platform working end to end, plus a design partner on a second.

### Chat-native approval

**Status:** **OQ-20**. v1 posts a link and the decision is taken in the console or the API. The
constraint is not negotiable — an approval must be attributable to a principal and bound to the
artifact digests that principal saw ([ADR-0011](../03-adr/0011-durable-human-approval-gates.md)).

**Trigger:** a design that satisfies the binding requirement, plus the founder deciding the convenience
is worth it.

### Fork-based delivery

**Status:** deferred, and it is the alternative an external security reviewer often prefers. The system
would hold no write access at all: fork, push to its own fork, open a cross-fork pull request. It lost
to the founder's decision on direct branch access, and to a real technical objection — cross-fork pull
requests do not run the target repository's CI with secrets in most hosts' default configuration, which
removes the customer's own checks from the loop
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

**Trigger:** a customer requiring it as a purchase condition. It is one module — delivery — which is why
it is affordable to defer.

### Billing, plans and entitlement enforcement for payment

**Status:** deferred, and **conditionally on the critical path** for the first time. There is no
pricing decision (**OQ-06**) and therefore no billing surface. What changed is that hosted operation
makes billing technically possible and commercially necessary: if **OQ-01** resolves to hosted, a
billing surface is needed to take money at all.

Note the distinction from entitlements, which **are** built: an entitlement is who may invoke what
([08-chat-front-door.md](08-chat-front-door.md)), and it is an authorisation mechanism rather than a
commercial one.

**Trigger:** OQ-01 resolving to hosted, or OQ-06 being answered.

### An identity provider integration

**Status:** **OQ-23**. Whether the console uses local accounts or an identity provider, and whether the
hosted deployment requires single sign-on.

**Trigger:** OQ-23, which depends on what the first deployment's users already have.

### Cross-tenant benchmarking

**Status:** deferred and fenced. A hosted deployment must not compute comparison figures across tenants
unless each has enabled it and the consent is recorded
([FR-138](03-functional-requirements.md)). **No cross-tenant figure appears in this specification,
because none has been measured.**

**Trigger:** tenants opting in, and a design partner asking to be compared against a cohort.

### A richer review surface

**Status:** deferred. Server-side rendering is retained
([FR-133](03-functional-requirements.md)), which means no client-side filtering of findings, no
drill-down on the dashboard and no live worksite burn-down.

**Trigger:** in [ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md) — a purchase condition, or
measured console load. Even then the first move is one enhanced page.

## Still deferred from before, unchanged

Listed so that a reader does not conclude the vision change reopened them.

| Deferred | Where | Still true because |
| --- | --- | --- |
| Greenfield project generation, and the specification-bundle design | [ADR-0019](../03-adr/0019-specification-first-projects.md) (Withdrawn), [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) | The verified lane needs a harness the system did not write. Nobody has asked for new projects |
| Feature development from a ticket | [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) | No reliable per-Task oracle, the work is attended, and it means competing on rented model quality |
| Parallel **Task** execution inside a Run | Seam 3, [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) | Concurrent patches against one workspace make failure attribution ambiguous. Worksites give concurrency *between* Runs instead |
| Cross-Run semantic memory and prompt evolution | Seam 7 | An unlogged influence breaks the property that a Run is explainable from its own log. Worksite state is rows and an event log, which is why worksites did not reopen this |
| Model-authored container image building | Seam 5 | Building a model-written Dockerfile executes arbitrary code with network access |
| Vector search over the repository | [ADR-0009](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md) | Structural retrieval answers the queries that matter for code, and an index is infrastructure to maintain |
| Fine-tuning or hosting model weights | [00-context/04-business-model.md](../00-context/04-business-model.md) | Rented capability, no compounding advantage |
| SIEM push and log shipping | Seam 6 | The pull-based export already lets a consumer build anything. Note that Seam 6's *webhook* prohibition was partly reversed by chat egress |
| Autonomous merge | [ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md) | The human merge gate is why the installation gets approved. Not deferred so much as refused, and it is listed here because it will be asked for within a week of adoption |
