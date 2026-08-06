# ADR-0013 — Single-tenant, self-hosted, four processes, one operator

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** NFR-021, NFR-022, [11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)

## Context

Two shapes are available for v1. A hosted multi-tenant service, where we run one deployment and every
customer is a tenant. Or a single-tenant deployment the customer installs and operates on their own
infrastructure.

The intake's positioning points at the second: on-premise compatibility, bring-your-own-cloud,
air-gapped operation, and local model inference. The team is one person. The buyer's security function
holds a veto and its central concern is where the source code goes.

This decision determines the threat model, the schema, the billing surface and the operational
burden, so it has to be made explicitly rather than drifted into.

## Decision

v1 is a **single-tenant, self-hosted deployment**: one installation per customer, on infrastructure
they control, operated by them.

Consequences that are now rules rather than preferences:

- At most four long-running processes ([NFR-021](../01-product/04-non-functional-requirements.md)). A
  fifth requires a superseding ADR.
- At most eight alert rules ([NFR-022](../01-product/04-non-functional-requirements.md)).
- No tenant table, no tenant column, no row-level security
  ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 2).
- No billing, plans or entitlements in the software.
- No Kubernetes, no service mesh, no cloud-provider dependency.
- Boring infrastructure is a design principle, stated as such
  ([01-system-overview.md](../02-architecture/01-system-overview.md#design-principles-as-tie-breakers)).

## Alternatives considered

### Hosted multi-tenant SaaS — rejected for v1

The strong case, and it is strong. One deployment we control means we can upgrade daily, observe real
usage, debug with full access, and iterate at a speed self-hosted customers will never permit. Support
is dramatically cheaper because there is one environment rather than one per customer. Billing is
possible. Onboarding is a signup rather than an installation, so the sales cycle is shorter and the
first design partner arrives sooner — which for a bootstrapped company is close to decisive.

It lost on the veto. The buyer this product is built for is the one whose security function refuses to
send source to a third party; serving them from our cloud discards the differentiator and puts us in
direct competition with far better-funded hosted agents. Multi-tenancy also imports the hardest part of
the threat model — isolation between customers' code and Sandboxes — for zero v1 revenue, on top of an
isolation boundary that is already the project's largest risk. And for one operator, running a
production service with customer data plus building the product is two jobs.

### Self-hosted but architected multi-tenant from the start — rejected

The case: add `tenant_id` everywhere now, so the eventual migration is trivial. It costs little today
and avoids a painful schema change later.

Rejected because a tenant column with no enforcement creates the *appearance* of isolation without the
substance — a reviewer sees the column and assumes a guarantee that does not exist, which is worse
than its absence. Real multi-tenancy is row-level security, key scoping, quota fairness and Sandbox
isolation between tenants, none of which is free, and building it untested and unused means it will be
wrong when it is finally needed. The migration is specified instead
([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)), and it is *supposed* to be
substantial.

## Consequences

### Positive

The threat model shrinks to one customer's own content. Source never leaves their perimeter unless
they configure it to. The operational surface fits one person, and every choice that would expand it
now has to argue past a numbered gate. Their compute and their tokens mean our marginal cost is
support.

### Negative

**We cannot see production.** No usage telemetry, no error aggregation, no ability to reproduce a
customer's failure without their audit export — which makes support slower and product learning
dramatically weaker than a hosted competitor's. Upgrades happen on the customer's schedule, so several
versions run in the field simultaneously and every migration must tolerate that. Installation is a
real barrier: [NFR-020](../01-product/04-non-functional-requirements.md) exists because a
30-minute bootstrap is the difference between adoption and abandonment, and it is a budget we must
defend. Per-usage billing is impossible without observing their deployment, which constrains the
pricing options in [00-context/04-business-model.md](../00-context/04-business-model.md) (OQ-06). And
the eventual multi-tenant migration is now genuinely expensive.

## Revisit when

Either: a design partner asks for a hosted deployment and accepts the data-handling implications, or
the installation barrier is measurably losing deals — evidenced by two or more prospects declining on
self-hosting alone. Reversing this decision means Seam 2 and a re-examination of
[ADR-0005](0005-gvisor-v1-firecracker-deferred.md), because hosted multi-tenancy raises the isolation
requirement to hardware boundaries.
