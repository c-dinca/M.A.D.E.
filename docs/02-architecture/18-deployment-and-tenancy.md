# Deployment modes and tenancy

One artifact, two modes, configured differently
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). This document
specifies the boundary that makes that claim true rather than aspirational, and it is written for the
security reviewer at a hosted customer, who asks a question a single-tenant deployment never had to
answer: *what stops another customer reading our source?*

The previous specification forbade all of this ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md),
Seam 2 in [15-future-phase-seams.md](15-future-phase-seams.md)) and its reason is now the strongest
constraint on the design:

> A nullable tenant column creates the **appearance** of isolation with none of the substance — a
> reviewer sees the column and assumes a guarantee that does not exist.

So this is not a column. It is the whole enforced boundary, or nothing.

## The two modes

| | `self_hosted` | `hosted` |
| --- | --- | --- |
| Operator | The customer | Us |
| Tenants | Exactly one, created at bootstrap | Many |
| Console identity | Local accounts or the customer's provider (OQ-23) | A configured identity provider, required |
| Source code is held by | The customer | **Us** |
| Perimeter argument available | Yes | No |
| Escape blast radius | One customer's own code | **Cross-customer** |
| Billing | Out of band | Needed to take money at all (OQ-06) |
| Upgrade cadence | Theirs; several versions in the field | Ours; daily if we want |
| We can see production | No | Yes |

**Which ships first is OQ-01** and no document may assume it. The trade is stated in
[00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md).

## The tenancy boundary

Five rules. Each is a requirement with a test, and the first two are the pair that makes the difference
between enforcement and decoration.

**1. `tenant_id NOT NULL` on every tenant-scoped table, in every unique constraint, in every index that
serves a tenant-scoped query, with row-level security enabled**
([FR-140](../01-product/03-functional-requirements.md)). There is no nullable tenancy and no synthetic
null tenant. The unique-constraint clause is the one most easily forgotten and the one whose absence is
worst: a unique index without the tenant column makes one tenant's identifier collide with another's,
which surfaces as a mysterious constraint violation rather than as a tenancy bug.

**2. The tenant is resolved from the authenticated principal, never from the request**
([FR-141](../01-product/03-functional-requirements.md)). Not a header, not a path parameter, not a body
field. A tenant taken from a request is a tenant an attacker chooses.

**3. Row-level security is the control that makes a mistake fail closed.** Application-level filtering
is necessary and insufficient: a missing `WHERE tenant_id = …` produces a query that works, returns
rows, and returns someone else's. That is the class of defect tests pass through, so the database
refuses it rather than the application remembering to. A static check over `made/store/` asserts that
no tenant-scoped query omits its predicate, and [NFR-029](../01-product/04-non-functional-requirements.md)
asserts unreachability against seeded cross-tenant attempts with row-level security active.

**4. Single tenancy is a configured cardinality, not a code path**
([FR-142](../01-product/03-functional-requirements.md)). A `self_hosted` deployment runs with one tenant
row created by bootstrap, and the API does not expose tenant creation there. Every query is still
tenant-scoped. The self-hosted install therefore exercises the same boundary the hosted one depends on,
which is what makes one test suite certify both.

**5. Tenant scope extends past the database** ([FR-144](../01-product/03-functional-requirements.md)):

| Surface | Scoping |
| --- | --- |
| Object store | Tenant prefix; an artifact digest alone MUST NOT resolve across tenants |
| Sandboxes | Already one per Run, never reused ([FR-054](../01-product/03-functional-requirements.md)). This property now carries tenant separation as well as Run hygiene |
| Git mirrors | Per project, and a project belongs to one tenant |
| Metrics | Tenant label; a hosted operator sees per-tenant series, a tenant sees only their own |
| Logs | `tenant_id` on every line that carries tenant-scoped data |
| Secrets | Per tenant in the host secret store; a tenant's repository credential is never resolvable by another tenant's Run |
| Audit export | Scoped to the requesting principal's tenant, always |

## Isolation between tenants, which is now the harder question

A Sandbox is per Run and destroyed after it — that was already true and it is the mechanism tenant
separation rests on at the execution layer. What changed is the **consequence of it failing**.

Under [ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md) an escape reached one customer's own
host, holding their own code: an incident. Under hosted multi-tenancy an escape is a **cross-customer
breach**, which is the difference between an incident and an extinction event
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).

**Nothing in this document accepts the existing boundary for multi-tenant hosting.** The question is
open, it is **OQ-10**, and it is open in the harder direction — toward hardware isolation, not away from
it. Seam 1 is the mechanism ([15-future-phase-seams.md](15-future-phase-seams.md)) and its trigger is now
much closer than when it was written.

> **Open question OQ-10** — Whether the strong-isolation requirement survives as specified, is relaxed
> to containers, or is deferred. The current specification requires a non-host kernel boundary
> ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)) because it assumed hostile-input and
> untrusted-code threat models, and both still hold. **ADR-0005's own revisit trigger has already fired
> on this** — it names "the deployment becomes multi-tenant or hosted by us" as a condition, and
> [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) met it — so this is not
> a new question so much as a scheduled one arriving. **Multi-tenant hosting raises the stakes rather
> than lowering them**: the same boundary now separates customers from each other, and
> [13-security-and-compliance.md](13-security-and-compliance.md) already states honestly that a
> vulnerability in the sandbox runtime's user-space kernel is a host compromise — which in a hosted
> deployment means every tenant on that host. **Blocks:** whether hosted operation can ship on the
> boundary described in ADR-0005 or requires Seam 1 first, and therefore part of OQ-01's answer space
> and the hosted milestone's cost. **Resolved by:** the founder deciding whether hosted tenants run on
> the current boundary, on hardware isolation, or on dedicated per-tenant hosts. Note that the option
> this project does not have is weakening the boundary to make hosting affordable — if the boundary is
> insufficient, hosted operation is suspended, not the boundary
> ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), revisit trigger).

## Deployment-mode agnosticism

**No capability may exist in one mode and not the other**
([FR-143](../01-product/03-functional-requirements.md)). A feature that only works hosted, or only
self-hosted, requires an ADR naming the reason.

**The mode is readable only inside `made/config/`.** Application code MUST NOT branch on it. The lint
rule that keeps the isolation runtime inside `made/sandbox/` and the vendor name inside
`made/llm/providers/` ([01-repo-structure.md](../04-engineering/01-repo-structure.md)) is extended to
`deployment_mode` for the same reason: a documented seam that leaks is a seam that stops holding.

What differs between modes is **configuration**, and only this:

| Configured | Typical hosted | Typical self-hosted |
| --- | --- | --- |
| Model endpoints | Ours | The customer's, possibly local |
| Identity provider | Required (OQ-23) | Optional |
| Chat egress | Enabled | Enabled or disabled |
| Inbound ingestion | Inbound endpoints | Inbound or polling ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)) |
| Retention | Ours, per OQ-02 | Theirs |
| Ceilings | Per tenant, by plan | Per tenant, by the operator |
| Tenant creation | Enabled | Disabled after bootstrap |

A capability disabled by configuration is not a missing capability. The distinction is what makes the
statement "the hosted service and a customer installation are the same artifact" checkable rather than
marketing.

## Roles across the boundary

The three existing roles are tenant-scoped: `operator` (everything within one tenant), `submitter`,
`auditor` ([03-api-design.md](03-api-design.md)).

A hosted deployment adds a **platform** role that administers tenants — create, suspend, set ceilings —
and that **MUST NOT be able to read any tenant's source, events, artifacts, findings or audit export.**
That separation is enforced by row-level security rather than promised by a role check, which matters
because it is the one privilege boundary whose failure is a breach of every customer at once.

The honest limit: a platform operator with database access can bypass any of this. Row-level security
constrains the application's principals, not the person holding the credentials. The controls that
apply there are operational rather than architectural — least-privilege database roles, audited access,
and the disclosure commitment in
[13-security-and-compliance.md](13-security-and-compliance.md#incident-response) — and pretending
otherwise would be the kind of overstatement that gets found in a security review.

## Migration and bootstrap

There is no migration from a single-tenant deployment, because tenancy is present from the first
migration. That is the entire reason this decision was taken before any row exists rather than after
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)): adding `tenant_id` to
every unique constraint and index *after* a customer's data exists is a migration under load, on a
schema whose invariants are the product's audit story.

Bootstrap in `self_hosted` mode creates one tenant, one `operator` principal, and nothing else. It does
not create a platform role, because there is no second tenant to administer.

## The cost, stated plainly

Every self-hosted install carries row-level security, tenant predicates on every query and an identity
integration for a table with one row. That is a real complexity tax on the deployment shape that is
most likely to ship first, and the operator debugging it at 22:00 pays it
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), negative consequences).

The compensating property is not efficiency. It is that there is one boundary, exercised by every
deployment, certified by one test suite — rather than a boundary that exists only in the deployment
where a mistake is unrecoverable.

## What is deliberately not built

**No cross-tenant anything.** No shared budget pool, no shared artifact deduplication across tenants
(content addressing is per tenant prefix, which forgoes a genuine storage saving), no cross-tenant
metrics, and no cross-tenant benchmark figures without recorded per-tenant consent
([FR-138](../01-product/03-functional-requirements.md)).

**No per-tenant encryption keys.** Row-level security and tenant prefixes are the boundary. Per-tenant
keys would be a key-management system to operate and would not change the failure mode that matters,
which is a query with a missing predicate.

**No tenant-level quota fairness.** Per-tenant caps bound the damage; the queue offers no fairness
guarantee ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)). This is the one item
from the old "not a user in v1" objection to shared infrastructure that remains unanswered, and it is
named rather than quietly dropped.

**No tenant self-service signup.** A tenant is created by a platform operator. Signup implies billing
(OQ-06) and an abuse surface nobody has designed.

**No mode-specific features**, and no code outside `made/config/` that knows which mode it is in.
