# The 2026-09 vision change: what reversed, what survived, what is now open

This document exists so that nothing was silently deleted. In September 2026 the founder substantially
changed the product vision, and the specification was rewritten around it. Several positions this
repository held — argued at length, and in some cases argued well — were reversed. A reversal with its
reasoning intact is worth more than a tidy history, because the argument that lost is the argument that
will be made again.

Read this if you are wondering why a document says something different from what you remember, or why a
rule you expected to find is gone.

## What the founder changed

The previous product, settled by
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) in August 2026, was
autonomous remediation of technical debt in existing repositories: work classes, a fixed task template
per class, the repository's own test suite as the oracle, delivered as pull requests, self-hosted,
single-tenant, operated by one person, with a run viewer as the only interface.

The new product is an environment in which a swarm of role-specialised agents lives inside a company's
development infrastructure and continuously takes over the work that consumes developer time. It adds:

- **the advisory lane** — code review on human pull requests, bug-finding, TODO triage — shipping in
  v1 rather than deferred;
- **worksites**, long-running migration campaigns spanning many pull requests and possibly many
  repositories;
- **a chat front door**, so that a non-developer can ask for a change in Discord, Teams or Slack;
- **a web console** with worksite monitoring, administration, budgets, approval policy and an
  effectiveness dashboard;
- **hosted multi-tenant operation**, alongside self-hosted, from one deployment-agnostic core;
- **residency** — reacting to events and running several worksites in parallel, rather than one
  request producing one Run.

Three things were decided at the same time and are not open: both deployment shapes are supported;
repository access is direct write access on branches only, as the system's own scoped identity; and the
advisory lane ships in v1 under a review-by-evidence constraint.

## Positions that were reversed

Each row names what the repository used to hold, what it holds now, and where the old argument is
preserved. In every case the old reasoning is retained rather than deleted, because in every case it
was accepted at full cost rather than refuted.

| Was | Is now | Old argument preserved in |
| --- | --- | --- |
| Single-tenant only; no tenant table, no tenant column, no row-level security | `tenant_id NOT NULL` on every tenant-scoped table, in every unique constraint and index, with row-level security; self-hosted runs one tenant row | [ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md), superseded by [ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) |
| Multi-tenancy is Seam 2 and agents must not build it | Multi-tenancy is v1 architecture; Seam 2 is closed | [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) |
| "Not a chat product. There is no free-form conversation surface with an agent." | A bounded chat request broker exists; conversation is capped at a declared clarification allowance | [01-problem-and-vision.md](01-problem-and-vision.md#non-goals), and the rule that survived is that an *approval* is still not a chat interaction |
| Chat platforms explicitly not integrated, for approvals or anything else; issue trackers refused as a Run trigger | Chat is an intake and status surface; approvals stay attributable (OQ-20) | [14-integrations.md](../02-architecture/14-integrations.md) |
| No outbound webhooks or push notification; Seam 6 forbids any outbound path to a customer-configured destination | Chat egress exists, on an allowlist, recorded as an egress decision, disableable per deployment | [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 6 |
| Exceeding the concurrency limit returns `429`; queueing is forbidden because an invisible queue hides cost and latency | Internally generated work queues, and every queued item is a visible row with a position, an age and a reason. Human API requests still get `429` | [03-api-design.md](../02-architecture/03-api-design.md), and the principle is preserved by visibility rather than by refusal |
| The interface is "an operational surface for one person at a time, not the product" | The console is a product surface with an effectiveness dashboard; the display rules and server-side rendering are retained | [ADR-0016](../03-adr/0016-server-rendered-run-viewer.md), superseded by [ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md) |
| A review class "is not the product" and needs "no sandbox, no budget ceiling, no termination guard and no audit trail" | The advisory lane ships in v1 and needs all four, because producing evidence means executing something | [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), rejected-alternatives section |
| `user` and `customer` are banned in code in favour of `operator` and `project` | `user`, `operator` and `principal` are three named concepts; `customer` stays banned in favour of `tenant` | [03-glossary.md](03-glossary.md#a-reversed-ban) |
| Air-gapped operation is "a supported configuration, not a failure mode" | Deferred. Chat egress, inbound ingestion and hosted operation each need connectivity, and nobody has asked for it | [01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md) |
| The buyer is an organisation whose security function will not let source leave the perimeter | Broader. Whether the perimeter argument is primary, secondary or dropped is **OQ-15** | [02-ecosystem-and-stakeholders.md](02-ecosystem-and-stakeholders.md) |

## Positions that survived, and are load-bearing

Listed because the temptation during a vision change is to treat everything as negotiable.

**The verification exit code is the only definition of Task success**
([ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md)). Untouched. The advisory lane does
not weaken it; it is fenced off from it.

**No work without a runnable check.** In the verified lane this is unchanged. In the advisory lane it
becomes the evidence requirement, which is the same instinct applied where an oracle is impossible:
produce something checkable or say you could not.

**The system never merges and never touches a default branch**
([FR-031](../01-product/03-functional-requirements.md),
[FR-032](../01-product/03-functional-requirements.md)). Reinforced rather than relaxed — the permission
envelope now forbids force-push, tags, settings, CI secrets, auto-merge and approving reviews as well
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

**No credentials in a Sandbox, no network during verification, no fallback for a missing isolation
runtime** ([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md),
[ADR-0015](../03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)). Unchanged, and the
multi-tenant decision makes the boundary question *more* urgent rather than less (OQ-10).

**Routing predicates and guards are pure** ([ADR-0002](../03-adr/0002-langgraph-as-executor-with-pure-routing.md)).
Unchanged, and now harder: schedules, queue ages, TTLs and worksite cycles are all time-bearing
mechanisms, and none of them may put a clock read in a predicate.

**Every effect writes its event in the same transaction.** Unchanged, and extended to ingress events
and worksite events.

**Cross-Run agent memory is still forbidden** ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md),
Seam 7). Worksite state is rows and an event log, not a model's carried context — which is what let
worksites be added without reopening that prohibition.

**The process-kind ceiling and the eight-alert ceiling hold**
([NFR-021](../01-product/04-non-functional-requirements.md),
[NFR-022](../01-product/04-non-functional-requirements.md)). NFR-021 is *clarified* to count process
kinds rather than processes, which is a loosening and is recorded as one
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

**Parallel Task execution inside a Run is still forbidden**
([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 3). Several worksites and
several Runs may proceed concurrently; the Tasks inside one Run may not.

**Greenfield generation is still out of scope**, and
[ADR-0019](../03-adr/0019-specification-first-projects.md) remains withdrawn.

## The contradiction that is not resolved

The chat front door and [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) are
in genuine tension and this specification does not resolve it.

ADR-0020 removed free-text intake from v1 and deferred generated planning: a Run is created from a work
class and reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`. A free-text message from a
non-developer is precisely the input the Architect was specified to handle and precisely the input
ADR-0020 said v1 would not accept.

[ADR-0025](../03-adr/0025-chat-front-door-request-broker.md) therefore specifies the narrow version —
match the message onto a work class the requester is entitled to, or decline with a reason — and
records the wider version as **OQ-19**. The two look identical in a demo and diverge the first time
somebody asks for something no template fits. The honest description of the v1 front door is *"ask for
a declared kind of maintenance, in plain language"*, and any material describing it as "describe any
change" is inaccurate until OQ-19 is answered.

The stories that were parked with the Architect — **US-004, US-005, US-006 and US-008** — remain parked
for the same reason, and they are the stories that come back if OQ-19 is answered in favour of
generated planning.

## What this document does not claim

No number in this revision was measured. Nothing in this repository has ever run. The advisory lane in
particular ships on a weaker guarantee than the verified lane by construction, and the measurements
that would justify it arrive after the decision to build it — that asymmetry is recorded in
[05-evidence-and-confidence.md](05-evidence-and-confidence.md) and is not fixable by more
specification.

The open questions this change created, and what each blocks, are in
[05-delivery/02-backlog.md](../05-delivery/02-backlog.md#open-questions). There are more of them than
before, which is the correct state for a product whose vision changed three weeks ago. A specification
that read as though everything were decided would be the dishonest version.
