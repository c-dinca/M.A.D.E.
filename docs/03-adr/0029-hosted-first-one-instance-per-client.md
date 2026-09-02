# ADR-0029 — Hosted first, one isolated instance per client; no shared multi-tenant runtime

**Status:** Accepted
**Date:** 2026-09-02
**Supersedes:** [ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md)
**Relates to:** OQ-01 (closed by this ADR), OQ-10, OQ-13, OQ-23, [ADR-0013](0013-single-tenant-self-hosted-v1.md), [02-architecture.md](../02-architecture.md)

## Context

[ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md) decided that both self-hosted and
hosted operation are supported from one deployment-agnostic core, and left which one ships first as
OQ-01. To make hosted operation safe it required the full multi-tenant boundary: `tenant_id NOT NULL`
in every unique constraint and index, row-level security on every tenant-scoped table, tenant
resolution from the authenticated principal, and tenant-prefixed artifacts.

That was the right conclusion from its own premise — a **shared** runtime serving many customers needs
an enforced boundary inside the database, and a nullable column would have been worse than nothing.
Its own negative section named the cost: every query wider, every mistake quieter, and a missing
predicate becoming a data-disclosure bug rather than a wrong answer.

The founder has now answered OQ-01, and the answer changes the premise rather than only the schedule.

## Decision

**Hosted first, and one isolated instance per client, operated by us.** There is no shared
multi-tenant runtime.

- A client gets their own instance: their own database, their own object store, their own execution
  host, their own configuration and their own credentials. Nothing of theirs is in a row next to
  anything of another client's.
- **The multi-tenancy machinery is therefore removed, not deferred.** No `tenants` table, no
  `tenant_id` column, no row-level security, no tenant resolution from the principal, no tenant
  prefixing. The requirements that specified it are cut
  ([07-deferred.md](../07-deferred.md)).
- Isolation between clients is achieved by **separation, not by predicates**. It is a deployment
  property, checkable by looking at what is running, rather than an invariant that has to hold in
  every query anyone writes.
- **Self-hosted becomes packaging, not a second product.** The instance we operate is the artifact a
  client eventually runs themselves. Nothing may be built that only works when we are the operator.
- Which host, which region and which model endpoint an instance uses is configuration set at
  provisioning. No default model endpoint is compiled in.

## Alternatives considered

### Keep ADR-0021's shared multi-tenant runtime — rejected

The advocate's case is real and it is about cost per customer. One runtime means one deployment to
upgrade, one database to back up, one set of migrations to run, and a marginal cost per client that
approaches zero. Every SaaS product of consequence is built this way, and the boundary ADR-0021
specified — `NOT NULL` plus row-level security — is the standard, well-understood answer that
thousands of products rely on.

Rejected because it buys operational efficiency with the one risk this project cannot absorb. Under a
shared runtime, a single missing tenant predicate or a single sandbox escape is a cross-customer
breach — and ADR-0021 itself recorded that as "the difference between an incident and an extinction
event". Separation removes that failure mode by construction instead of defending against it in every
query, forever, with one maintainer. It also removes the complexity tax ADR-0021 accepted: row-level
security, tenant predicates and an identity integration for what is, in every instance, one client.

The efficiency argument is genuine and is deliberately paid: see the negative consequences.

### Self-hosted first — rejected

The case, and it was strong enough that the previous positioning rested on it: a customer whose
contract forbids sending source to a third party can only use a self-hosted install, and "your code
never leaves your infrastructure" is the hardest version of the security argument.

Rejected on feedback speed. Self-hosted means an installer, a supported host matrix, an upgrade path,
several versions in the field simultaneously, and debugging environments we cannot see — before we
know whether the product works at all. Hosted returns feedback in days rather than release cycles.
The perimeter argument is relegated to secondary rather than abandoned (**OQ-15**, which stays
open), and the instance-per-client shape keeps the self-hosted path cheap: it is the same artifact
with a different operator.

### Hosted, one shared instance for small clients and dedicated instances for large ones — rejected

The case: it is the commercial middle, and it lets small clients be served at near-zero marginal cost
while offering isolation as a paid tier.

Rejected because it is both shapes at once. The shared instance needs the whole boundary ADR-0021
specified, so nothing is saved; and having two shapes means the escape suite and the invariant
queries certify one of them properly. If a shared tier is ever wanted, it is an ADR that reinstates
the boundary, not a configuration flag.

## Consequences

### Positive

The largest class of unrecoverable failure — one client's source reaching another — is removed by
architecture rather than defended by discipline. The schema, every query, every index and every
object-store path get simpler, and the boundary is inspectable by looking at what is deployed. We can
see production, upgrade on our own schedule, and get feedback in days. ADR-0013's argument returns
in a better form: single tenancy per instance, but operated by us rather than by a customer who
cannot tell us what broke. And self-hosted stops being a second product.

### Negative — mandatory

**Marginal cost per client is no longer near zero.** Every client is a database, an object store, an
execution host and a backup schedule. That is the efficiency the rejected alternative would have
bought, and it is paid in infrastructure and in provisioning work. Pricing has to cover it, and there
is no pricing decision (OQ-06 is deferred with the specification — see below).

**Upgrades fan out.** One instance per client means N deployments to migrate and restart, and the
first time a migration behaves differently on one client's data than on another's, the "one artifact"
claim is tested. This is the self-hosted upgrade problem arriving early, in a form we control.

**Provisioning is now a product surface** — instance creation, configuration, credentials, teardown —
and it did not exist in either previous decision. It is not in the first three milestones, which
means the first clients are provisioned by hand, deliberately.

**We hold clients' source code.** Backups contain it, support contains it, and a laptop with a
database dump contains it. Separation bounds the blast radius to one client; it does not remove the
obligation. The compliance question is deferred rather than answered, which is a real gap
([07-deferred.md](../07-deferred.md)).

**A hostile operator of ours bypasses everything.** Instance separation constrains the software, not
a person with access to the hosts. That was true under ADR-0021 as well and remains the honest limit.

**OQ-15 becomes load-bearing and unresolved.** Hosted-first is only correct if the perimeter argument
is genuinely secondary. If the client network turns out to be regulated industries, this decision is
wrong and so is half the roadmap — which is exactly why OQ-15 stays open with that consequence
written into it.

## Revisit when

Either: a client requires operating the instance themselves as a purchase condition, which is
packaging work on this artifact rather than a new decision; or measured infrastructure cost per client
exceeds what the price can carry, in which case the shared-runtime alternative reopens **with the full
boundary ADR-0021 specified** — never with a partial one.
