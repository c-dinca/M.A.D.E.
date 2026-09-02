# ADR-0021 — One deployment-agnostic core serving both self-hosted and hosted multi-tenant operation

**Status:** **Superseded by [ADR-0029](0029-hosted-first-one-instance-per-client.md)**, 2026-09-02 — the same day it was accepted.
**Date:** 2026-09-02
**Supersedes:** [ADR-0013](0013-single-tenant-self-hosted-v1.md)

> **Superseded within hours, by the answer to the question it left open.** This record decided that
> both deployment shapes are supported from one core and left *which ships first* as OQ-01. The
> founder answered OQ-01 with **hosted first, one isolated instance per client, no shared
> multi-tenant runtime** — which removes the premise this decision was reasoning from.
>
> **What is reversed:** the multi-tenancy machinery. With one instance per client there is no shared
> runtime, so `tenant_id NOT NULL`, row-level security, tenant resolution from the principal and
> tenant prefixing are unnecessary. They are **removed rather than deferred**
> ([ADR-0029](0029-hosted-first-one-instance-per-client.md)).
>
> **What survives, and is why this record still matters:** its central argument. A shared runtime
> needs the whole enforced boundary or nothing, because a nullable tenant column creates the
> appearance of isolation with none of the substance. ADR-0029 does not weaken that argument — it
> avoids needing it, by separating instances instead. If a shared tier is ever wanted, **this is the
> design to revive, in full**, not a partial version of it.
>
> Its negative section also predicted exactly the cost that made this reversal attractive: "every
> query and index gets wider, and every mistake gets quieter", and "single-tenant deployments pay for
> a boundary they do not use".
**Relates to:** OQ-01, OQ-10, [UF-1](../02-architecture.md), [UF-4](../02-architecture.md), [18-deployment-and-tenancy.md](../02-architecture.md), [15-future-phase-seams.md](../02-architecture.md)

## Context

[ADR-0013](0013-single-tenant-self-hosted-v1.md) chose a single-tenant, self-hosted deployment for v1
and forbade the mechanisms multi-tenancy needs: no tenant table, no tenant column, no row-level
security, no billing. Seam 2 in [15-future-phase-seams.md](../02-architecture.md)
recorded the migration and instructed agents not to build it. That instruction was correct under the
decision it served.

The founder has now stated that **both shapes are supported**: a hosted multi-tenant service that we
operate, and a customer installation that they operate. The architecture must not assume either. This
is not a scheduling change to ADR-0013 — it inverts its central prohibition, so it needs a superseding
record rather than an amendment.

The reason ADR-0013 refused a half-measure remains binding and is the hardest constraint on this
decision: *a nullable tenant column creates the appearance of isolation with none of the substance, and
a reviewer who sees the column assumes a guarantee that is not there.* Reversing the prohibition
therefore does not mean adding a column. It means building the whole enforced boundary, or nothing.

## Decision

There is **one artifact**. A deployment is the same code, the same schema and the same contracts,
configured differently. Two modes exist and they are configuration, not build variants:

| Mode | Operator | Tenants | Identity |
| --- | --- | --- | --- |
| `self_hosted` | The customer | Exactly one, created at bootstrap | Local accounts or the customer's identity provider |
| `hosted` | Us | Many | Required identity provider |

Rules that follow, each enforceable:

- Every tenant-scoped table MUST carry `tenant_id NOT NULL`. It MUST appear in every unique constraint
  and every index that serves a tenant-scoped query, and row-level security MUST be enabled on it.
  There is no nullable tenancy and no synthetic-null tenant.
- A `self_hosted` deployment MUST run with exactly one tenant row, created by bootstrap and not
  creatable through the API. Single tenancy is a configured cardinality, not a different code path.
- No query, artifact prefix, object-store path, sandbox name, metric label or log field may reach
  tenant-scoped data without a tenant in scope. The tenant is resolved from the authenticated
  principal, never from a request field.
- **No capability may exist in one mode and not the other.** A feature that only works hosted, or only
  works self-hosted, requires an ADR naming the reason. Configuration may disable a capability in a
  deployment; the code may not know which mode it is in outside `made/config/`.
- One tenant's execution MUST occupy its own Sandbox. Sandboxes were already per-Run and never reused
  ([04-execution-isolation.md](../02-architecture.md)); this decision makes that
  property load-bearing for tenant separation rather than only for Run hygiene.
- Which mode **v1 targets first** is not decided here and MUST NOT be assumed by any document or
  backlog item. It is OQ-01.

## Alternatives considered

### Keep ADR-0013 and treat hosted operation as a later phase — rejected

The strongest case, and it is the case ADR-0013 already made and won on: multi-tenancy imports the
hardest part of the threat model — isolation between different customers' code and Sandboxes — for zero
revenue, on top of an isolation boundary that is already the project's largest risk. For one operator,
running a production service with other people's source in it *and* building the product is two jobs.
Every argument in ADR-0013 is still true and none of it has been refuted by evidence.

It loses because the retrofit is the expensive part and it is now foreseeable. ADR-0013 itself records
that the eventual migration is "genuinely expensive" and "supposed to be". Adding `tenant_id` to every
unique constraint, every index and every key-resolution path *after* a customer's data exists is a
migration under load, on a schema whose invariants are the product's audit story. Deciding tenancy
before the first row is written costs a column and a policy; deciding it afterwards costs a migration
plan per installation. Given that hosted operation is now a stated requirement rather than a
possibility, paying for it now is cheaper than paying for it later — and the honest cost is recorded
below.

### Two artifacts: a hosted service and a self-hosted distribution — rejected

A real case, and it is how most companies with both shapes actually end up. The hosted service can
assume an identity provider, a managed database, horizontal scaling and daily upgrades; the
distribution can stay small and boring. Neither is compromised by the other's constraints, and each can
move at its own speed.

Rejected because two artifacts means two behaviours, and the properties this product is sold on are
behavioural: the isolation boundary, the budget ceiling, the audit completeness. Two code paths means
the escape suite, the replay corpus and the invariant queries each certify one of them, and the other
is certified by hope. It also doubles the surface a single maintainer supports, which is the failure
ADR-0013 was protecting against in the first place — so the alternative that looks like less work is
the one that produces two half-tested products.

### Multi-tenant only, dropping self-hosted — rejected

The case is speed: one deployment we control, upgraded daily, observable, debuggable with full access,
and no installer to write. It is what ADR-0013 called "close to decisive" for a bootstrapped company.

Rejected because the buyer whose client contract forbids sending source to a third party cannot use it
at all ([ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) rests on exactly that buyer),
and because the founder has stated both are required. Whether the *security perimeter* remains a
primary selling point is a separate and still-open question (OQ-15); whether self-hosted operation is
supported is not open.

## Consequences

### Positive

Tenancy is enforced rather than promised, which is the only version of it worth having. The hosted
service and a customer installation are provably the same system, so the escape suite, the replay
corpus and the invariant queries certify both at once. The multi-tenant migration that ADR-0013
deferred stops existing as future work. And the hosted mode restores the feedback loop ADR-0013's
negative section named as its worst cost — we can see production for our own tenants.

### Negative — mandatory

**The threat model grows immediately and permanently.** Under ADR-0013 the worst case was one
customer's own code escaping into one customer's own host. Hosted operation makes an escape a
cross-customer breach, which is the difference between an incident and an extinction event. This
directly raises the isolation requirement, and the boundary question that ADR-0005 settled for a
single-tenant host is reopened as OQ-10. **Nothing in this ADR should be read as accepting the
existing boundary for multi-tenant hosting.**

**Every query and index gets wider, and every mistake gets quieter.** A missing tenant predicate is
now a data-disclosure bug rather than a wrong answer. This is the class of defect that tests pass
through: the query works, returns rows, and returns someone else's. Row-level security is the control
that makes it fail closed, and it has to be right on every table from the first migration.

**We now operate a production service with other people's source code in it.** Backups contain it.
Support contains it. A laptop containing a database dump contains it. That is an obligation ADR-0013
did not have and it does not go away by being documented — and the compliance questions OQ-02 records
stop being a customer's problem and become ours.

**Single-tenant deployments pay for a boundary they do not use.** Every self-hosted install carries
row-level security, tenant predicates and an identity provider integration for a table with one row.
This is a real complexity tax on the deployment shape that is most likely to ship first, and the
operator debugging it at 22:00 pays it.

**One artifact means the constraints compose rather than cancel.** The hosted service inherits
"must run on a customer's single host with four process kinds" and the self-hosted install inherits
"must be safe with several tenants". Each shape is worse than it would be alone. That is the price of
not having two of them.

**Billing becomes possible, which makes pricing urgent.** ADR-0013's negative section noted that
per-usage billing was impossible without observing the deployment. For hosted tenants it is now
possible, so OQ-06 stops being comfortably deferred.

## Revisit when

Either: the isolation boundary chosen under OQ-10 proves insufficient for multi-tenant execution, in
which case hosted operation is suspended rather than the boundary weakened — the one direction this
project does not trade; or the measured support cost of the mode that does not ship first exceeds what
one maintainer can carry, in which case the honest move is to stop *offering* that mode while keeping
the single artifact, not to fork it.
