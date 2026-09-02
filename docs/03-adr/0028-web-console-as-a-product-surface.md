# ADR-0028 — The web console is a product surface with an effectiveness dashboard; its rendering stays server-side until a trigger

**Status:** Accepted
**Date:** 2026-09-02
**Supersedes:** [ADR-0016](0016-server-rendered-run-viewer.md)
**Relates to:** [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), FR-045, FR-067, [ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md), [ADR-0022](0022-two-lanes-verified-and-advisory.md), [01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md), OQ-18, FR-123 to FR-133

## Context

[ADR-0016](0016-server-rendered-run-viewer.md) decided that the interface is a server-rendered run
viewer, that it is "an operational surface for one person at a time, not the product", and that no
single-page application would be built. That was right for a product whose only user was the operator
who installed it and whose deliverable was consumed in a git host's pull-request page.

Three of that decision's premises are now false. Hosted multi-tenant operation
([ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md)) means several people from
different organisations use the interface concurrently, with identity and permissions rather than one
shared API key. Worksites ([ADR-0024](0024-worksites-as-long-running-campaigns.md)) and the chat front
door ([ADR-0025](0025-chat-front-door-request-broker.md)) create entities with no representation in a
git host at all — a campaign's progress and a declined request exist nowhere else. And the founder has
asked for an admin console: budgets, approval policy, roles, permissions, audit access.

There is also something the interface must do that no document currently assigns to anything, and it is
the most commercially important item in this revision. A company renewing this product asks one
question: *did it save us more than it cost.* The numbers that answer it — acceptance rate per task
class, cost per merged pull request, human intervention rate, time from request to merge — are all
derivable from the event log and none of them is reported anywhere. Every product in this category
reports activity instead: runs executed, comments posted, pull requests opened. Activity is the number
that always goes up.

Reporting effectiveness honestly is the same commitment as
[UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), one level up. UF-3
says the system does not claim a Task succeeded without proof; the dashboard says the product does not
claim it was worth paying for without proof. Refusing the second while enforcing the first would be
inconsistent, and the inconsistency would be in our favour, which is the direction that should make a
reader suspicious.

## Decision

**The console is a product surface, not an operational afterthought.** Its page set covers Runs,
worksites, requests, findings, effectiveness, budgets and alerts, approval policy, users and teams,
repository access status, and audit export (FR-123). What lands in the first version and what comes
later is **OQ-18** and is not decided here; the page set is the specification of the whole, and any
subset that ships MUST satisfy the display rules below.

**An effectiveness dashboard is required, not optional** (FR-124). It reports, per lane and per work
class, with an explicit window:

| Measure | Definition |
| --- | --- |
| Acceptance rate | Delivered pull requests merged **with no human edit to the diff**, over pull requests delivered |
| Cost per merged pull request | Total spend attributable to the class over the period, divided by merged pull requests — with cost per failed Run reported beside it, never averaged in |
| Human intervention rate | Runs that required a human to make progress, over Runs created |
| Time from request to merge | p50 and p95 wall-clock from the triggering event to the merge |
| Advisory acceptance rate | Findings resolved by a change, over findings delivered |
| Evidence ratio | Findings carrying evidence, over findings delivered ([ADR-0023](0023-advisory-findings-carry-evidence.md)) |
| Worksite burn-down | Measured remaining count over time, on merged state ([ADR-0024](0024-worksites-as-long-running-campaigns.md)) |

**Every figure on it is derived from the event log by a query that a customer can run themselves**
(FR-125). No figure may be computed from a rollup table, a framework checkpoint, or a number an agent
produced ([ADR-0004](0004-event-log-separate-from-checkpoints.md)). The query behind each measure is
published.

**The display rules from [ADR-0016](0016-server-rendered-run-viewer.md) are retained in full and
extended** (FR-126). Verification status renders as *verified*, *failed verification* or *not
verified*; a parked Run renders as "waiting for approval" with its reason, never as a spinner; unknown
values render as "unknown", never as zero. Added: the lane is visible before the content and a
verified result is rendered differently from a suggestion
([ADR-0022](0022-two-lanes-verified-and-advisory.md)); a `demonstrated` finding is rendered differently
from an `unverified` one ([ADR-0023](0023-advisory-findings-carry-evidence.md)); a measure with
insufficient data renders as "insufficient data" with the count, never as 0%; and work in flight is
never rendered as progress. These are product requirements with tests, not styling.

**Rendering stays server-side** (FR-127). This ADR expands the *scope* of the interface and does not
reverse ADR-0016's technology choice, because no requirement stated by the founder needs a client
application and inventing one here would be a decision nobody asked for. Progressive enhancement for
polling and for a chart is permitted; a separate frontend build, a framework and a second deployment
artifact are not, until the trigger below. The consequence to accept is that this constrains what the
dashboard can look like.

**Administration is first-class and every administrative action is an event** (FR-128). Budgets per
tenant, per team, per repository and per worksite, with alert thresholds. Approval policy binding
`(scope, lane, work class)` to the principals who may approve and a minimum approver count, defaulting
to one, with self-approval of one's own chat request forbidden by default (FR-129). Users, teams and
roles. Repository access status including `access_revoked` and `access_insufficient`
([ADR-0027](0027-scoped-application-identity-branches-only.md)). Audit export reachable by an
`auditor` principal without any capability to start work (FR-130).

**No console surface may execute anything on demand** (FR-131). The rule from
[03-api-design.md](../02-architecture/03-api-design.md) holds unchanged: there is no "run this command",
no "force this transition", no "approve all". The console is a view and a decision surface over the
same API, with the same role enforcement, and it MUST NOT have a private endpoint.

**Cross-tenant aggregation is off by default and requires explicit configuration** (FR-132). A hosted
deployment MUST NOT compute benchmark or comparison figures across tenants unless each tenant has
enabled it, and MUST record that consent. **No cross-tenant figure is published in this specification,
because none has been measured.**

**Every dashboard measure carries the count it was computed from** (FR-133). A 100% acceptance rate over
two pull requests is not a 100% acceptance rate, and a surface that shows the percentage without the
denominator is the same defect as rendering unknown as zero.

## Alternatives considered

### Keep ADR-0016 unchanged: run viewer only — rejected

The case is the one ADR-0016 made and it was correct at the time: the interface competes for the
founder's attention with the isolation boundary and the evaluation harness, which are what the product
is sold on; the git host already provides the best diff viewer; and one process, one language, one
dependency tree is what keeps a solo-operated system operated.

It loses because worksites, requests and findings have no representation anywhere else, so "the git
host shows it" stops being true, and because hosted multi-tenancy needs identity, permissions and
budget administration that an API-key-per-caller model does not provide. What survives is the whole of
its technology argument, which is why FR-127 keeps server-side rendering.

### Build a single-page application now — rejected

The strong case: a worksite burn-down over weeks, a findings queue with filtering, and an effectiveness
dashboard with drill-down are the kind of interface a component framework makes straightforward and
server-rendered HTML makes tedious. Hosted customers will compare this to products with real
interfaces, and appearance affects renewal, not just the first sale.

Rejected because nothing in the stated requirements needs it and choosing it here would be inventing a
decision. ADR-0016's cost argument is unchanged: a build toolchain, a dependency tree with its own
vulnerability surface, a second deployment artifact and API contracts to keep in step, paid for out of
one person's attention. The trigger below names what would change this, and it is deliberately a
requirement rather than a preference.

### Ship the dashboard as an exported dataset with no interface — rejected

A real case, and it is consistent with how the audit export is designed: publish the queries and the
data, let the customer build the view in whatever they already use. Zero interface to maintain, no
charting library, and the customer's own tool is better than ours.

Rejected because the person who decides on renewal will not run a query, and a number nobody looks at
does not inform a decision. The export is retained — every measure's query is published (FR-125) — but
it is in addition to the view, not instead of it.

### Report activity metrics instead: runs, pull requests opened, comments posted — rejected

The advocate's case is honest about incentives: activity metrics are unambiguous, always available,
never negative, and every competitor reports them, so reporting them is the industry norm rather than
a deception.

Rejected because it is the same failure as reporting a Task successful without an exit code, and this
product has no standing to commit it. Activity is what the system did; effectiveness is what the
customer got. Activity figures are retained as *operational* metrics for the operator
([12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)) and are excluded from
the effectiveness dashboard.

## Consequences

### Positive

The buyer gets the numbers that justify renewal, computed from the audit log by published queries,
which is a claim no competitor in this category makes honestly. The console gives worksites, requests
and findings a home they otherwise lack. Administration becomes a recorded, reviewable surface rather
than a configuration file the operator edits. And keeping the rendering server-side preserves the
process-kind ceiling and the one-dependency-tree property that make this maintainable by one person.

### Negative — mandatory

**The dashboard will publish uncomfortable numbers about our own product, in front of the person
deciding whether to pay.** A low acceptance rate or a high intervention rate is visible immediately,
early, when the sample is small and the system is at its worst. That is the point, and it is also a
commercial risk taken deliberately — and the "insufficient data" rule will make the product look
uncertain precisely when a competitor's dashboard is showing a confident number computed from nothing.

**Server-side rendering constrains the dashboard.** No drill-down, no client-side filtering, no live
burn-down; a worksite view over weeks of cycles is a paginated table and a static chart. This will look
worse than competitors' interfaces in a demo, and ADR-0016 already recorded that appearance affects the
sale.

**Effectiveness measures need data the system does not currently capture.** "Merged with no human edit"
requires comparing the merged diff to the delivered one, which means reading the merge commit — a new
git read path and a new correctness problem, since a rebase, a squash or an unrelated concurrent commit
can all make an unedited pull request look edited. Getting this wrong understates or overstates the
headline number, and it is the number the kill criteria are gated on.

**The console becomes a surface with permissions, and permissions are where authorisation bugs live.**
Multi-tenant, multi-team, per-repository, per-lane — a missing check here is a cross-tenant disclosure
rather than a wrong page.

**Administration through an interface invites the affordances this system refuses.** Every admin
console anyone has used has a "retry", a "force", an "approve all" and an "edit". Each will be
requested, each is forbidden by FR-131, and each refusal has to be explained again.

**The operator's page count grows well past what one person maintains casually**, and every page carries
truthful-rendering tests it must not be shipped without.

## Revisit when

The rendering decision reopens when either: a customer requires a richer review or campaign-monitoring
surface as a purchase condition; or measured concurrent console use in a hosted deployment makes
full-page polling a load problem rather than a theoretical one. Even then, the first move is
ADR-0016's: a JavaScript-enhanced page for the specific view that needs it, not a full application. The
dashboard's *measure set* reopens when a design partner names a number they use to justify renewal that
is not on the list.
