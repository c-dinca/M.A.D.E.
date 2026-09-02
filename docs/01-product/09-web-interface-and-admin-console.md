# The console and the effectiveness dashboard

The **console** is the whole web surface: Runs, worksites, requests, findings, effectiveness,
administration and audit ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). The **run
viewer** is one page inside it, and the term is retained because it names that page.

This was previously out of scope beyond the run viewer, on the grounds that the interface was "an
operational surface for one person at a time, not the product"
([ADR-0016](../03-adr/0016-server-rendered-run-viewer.md)). Three of that premise's foundations are now
false: hosted multi-tenant operation means several people from different organisations use it
concurrently with identities and permissions; worksites and requests have no representation in a git
host at all; and the founder has asked for administration.

Two things about it are settled and neither is what a reader might expect.

**Rendering stays server-side** ([FR-133](03-functional-requirements.md)). ADR-0028 expands the
interface's *scope* and does not reverse ADR-0016's technology choice, because nothing in the stated
requirements needs a client application and choosing one here would be inventing a decision. The
consequence is accepted rather than hidden: a worksite view over weeks of cycles is a paginated table
and a static chart, and this will look worse in a demo than a competitor's interface.

**The console executes nothing on demand** ([FR-137](03-functional-requirements.md)). It is a view and
a decision surface over the same API, with the same role enforcement, and it has no private endpoint.
There is no "run this command", no "force this transition", no "retry", no "approve all" and no "edit
this event". Every admin console anyone has used has those affordances; each is forbidden here, and
each refusal will have to be explained again.

## The effectiveness dashboard, and the argument for it

A company renewing this product asks one question: **did it save us more than it cost.** The numbers
that answer it are all derivable from the event log and none of them is reported anywhere in the
current specification.

Every product in this category reports activity instead — runs executed, comments posted, pull requests
opened. Activity is the number that always goes up. It measures what the system did, not what the
customer got, and presenting it as evidence of value is the same class of untruth as reporting a Task
successful without an exit code.

So the argument for the dashboard is not that it is a nice feature. It is consistency:

> [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) says the system does
> not claim a Task succeeded without proof. The dashboard says the product does not claim it was worth
> paying for without proof. Enforcing the first while advertising activity metrics about ourselves
> would be an inconsistency in our own favour — which is the direction that should make a reader
> suspicious.

It is also the instrument the kill criteria are gated on
([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)). The same numbers decide whether the
customer keeps paying and whether we keep building, which is the only arrangement in which the numbers
can be trusted.

### The measures

Reported **per lane and per class**, with an explicit window
([FR-130](03-functional-requirements.md)). Blending across lanes is forbidden
([FR-094](03-functional-requirements.md), [06-lanes.md](06-lanes.md)).

| Measure | Definition | Why this one |
| --- | --- | --- |
| **Acceptance rate** | Delivered pull requests merged **with no human edit to the diff**, over pull requests delivered | The headline. A merge after a human rewrote the diff is a supervision event, not a delegation |
| **Cost per merged pull request** | Spend attributable to the class over the window, over merged pull requests | The unit economics question, in the buyer's denominator rather than ours |
| **Cost per failed Run** | Reported **beside** the above, never averaged into it | The average of the two hides the number that determines viability ([07-cost-control.md](../02-architecture/07-cost-control.md)) |
| **Human intervention rate** | Runs that required a human to make progress, over Runs created | Distinguishes automation from supervision. This is the number that says whether the product is what it claims |
| **Time from request to merge** | p50 and p95 wall-clock from the triggering event to the merge | The requester's experience, and the only measure that includes the customer's own review latency |
| **Advisory acceptance rate** | Findings resolved by a change, over findings delivered | The advisory lane's only quality signal ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)) |
| **Evidence ratio** | Findings carrying evidence, over findings delivered | Shows whether the review-by-evidence rule is honoured or quietly abandoned ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)) |
| **Worksite burn-down** | Measured remaining count over time, on merged state, with work in flight shown separately | Campaign progress, told truthfully ([07-worksites.md](07-worksites.md)) |

### Four rules that make the numbers trustworthy

**Every figure comes from the event log, by a query that is published**
([FR-131](03-functional-requirements.md)). Not from a rollup table, not from a framework checkpoint
([ADR-0004](../03-adr/0004-event-log-separate-from-checkpoints.md)), and not from a number an agent
produced. A customer who disbelieves a figure can run the query.

**Every measure carries the count it was computed from** ([FR-139](03-functional-requirements.md)). A
100% acceptance rate over two pull requests is not a 100% acceptance rate. A percentage without its
denominator is the same defect as rendering unknown as zero.

**Insufficient data renders as "insufficient data"**, with the count, never as 0% and never as a
flattering figure over three samples ([FR-132](03-functional-requirements.md)). This will make the
product look uncertain in exactly the window where a competitor's dashboard shows a confident number
computed from nothing. That is the trade.

**Cross-tenant aggregation is off by default** ([FR-138](03-functional-requirements.md)). A hosted
deployment does not compute benchmark or comparison figures across tenants unless each has enabled it,
and the consent is recorded. **No cross-tenant figure appears anywhere in this specification, because
none has been measured.**

### The measurement problem to solve before trusting the headline

"Merged with no human edit" requires comparing the merged diff to the delivered one, which means
reading the merge commit — a new git read path and a genuine correctness problem. A rebase, a squash or
an unrelated concurrent commit can each make an unedited pull request look edited, and the failure is
silent.

Getting it wrong misstates the number the kill criteria are gated on, and the error direction that
matters is the flattering one. It is recorded as a load-bearing unproven claim
([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)) and the
mitigation is a hand-checked sample compared against the computed figure
([NFR-039](04-non-functional-requirements.md)) — not a cleverer algorithm.

## Page set

What lands **first** versus later is **OQ-18**. The list below is the specification of the whole; any
subset that ships must satisfy the display rules ([FR-129](03-functional-requirements.md)).

| Page | Shows | Decides |
| --- | --- | --- |
| **Run list** | Runs by tenant, project, lane, state, outcome | — |
| **Run detail** (the run viewer) | Event timeline with per-step cost, Tasks with verification results, attempt trail, artifacts, spend against ceiling | Approve or reject delivery; cancel |
| **Worksite list** | Remaining, work in flight, escalated, spend against ceiling, cycle number | — |
| **Worksite detail** | Burn-down on merged state, slice list with per-slice outcome, claims held, ceilings | Create; pause; resume; abandon |
| **Request queue** | Requests by state, with declines and their reasons | Withdraw; re-triage |
| **Findings** | Findings by class, filtered by evidence state, with their evidence records | — (resolution happens in the git host) |
| **Effectiveness** | The measures above, per lane and per class, with counts | — |
| **Budgets and alerts** | Ceilings and spend at tenant, team, repository and worksite level, with thresholds | Set ceilings and thresholds |
| **Approval policy** | Which principals may approve what | Edit policy |
| **Users, teams, roles** | Principals, their teams, their roles, their entitlements | Invite; assign; revoke |
| **Repositories** | Registration status, permission envelope status, `access_revoked` and `access_insufficient` states | Register; disable; re-verify access |
| **Queue** | Queued work with position, age, reason and cause ([FR-117](03-functional-requirements.md)) | — |
| **Audit** | Event search and export by Run, worksite or request | Export |

## Administration

Every administrative action is an event ([FR-134](03-functional-requirements.md)). Configuration is
versioned and immutable per version, so a Run is always explainable against the configuration it
executed under ([FR-005](03-functional-requirements.md)).

**Budgets** exist at four levels — tenant, team, repository and worksite — each with alert thresholds
([FR-134](03-functional-requirements.md)). Setting a lower ceiling takes effect on the next admission
check; raising one is recorded and does not affect a Run already parked with `budget_exhausted`, which
requires a new Run.

**Approval policy** binds `(scope, lane, work class)` to the principals who may approve, with a minimum
approver count defaulting to one ([FR-135](03-functional-requirements.md)). Two defaults are
deliberate: self-approval of one's own chat request is forbidden, and a policy that would leave a scope
with no eligible approver is rejected rather than saved — a scope nobody can approve is a scope where
work accumulates invisibly.

**Roles** are the three that already exist, extended for tenancy: `operator` (everything within a
tenant), `submitter` (create Runs on permitted projects, approve where the policy allows), `auditor`
(read Runs, events and exports; **no** capability to start work,
[FR-136](03-functional-requirements.md)). A hosted deployment adds a platform role that can administer
tenants and can read no tenant's source or events — and that separation is enforced rather than
promised.

**Repository access status** is surfaced explicitly, because a fail-closed access boundary looks like an
outage to whoever hits it. A repository in `access_revoked` or `access_insufficient` says which
permission is missing and what to do
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)), so the operator does not go
looking for a retry button that does not exist.

## Display rules

Retained in full from [ADR-0016](../03-adr/0016-server-rendered-run-viewer.md) and extended
([FR-132](03-functional-requirements.md)). These are product requirements with tests, not styling.

- Verification status renders as *verified*, *failed verification* or *not verified*, in those words.
- A Run parked in `AWAIT_HUMAN` renders as "waiting for approval" with its reason, **never** as a
  progress spinner.
- Unknown values render as "unknown", **never** as zero.
- The **lane** is visible before the content, and a verified result is rendered differently from a
  suggestion ([FR-087](03-functional-requirements.md)).
- A `demonstrated` finding is rendered differently from an `unverified` one, and a `demonstrated`
  finding leads with its command and exit code ([FR-089](03-functional-requirements.md)).
- A measure with insufficient data renders as "insufficient data" with the count, never as 0%.
- **Work in flight is never rendered as progress** ([FR-096](03-functional-requirements.md)).
- Queued work shows its position, age and the reason it is waiting
  ([FR-117](03-functional-requirements.md)).
- No completion estimate is shown without the number of cycles it was computed from.

## What is deliberately not built

**No single-page application** ([FR-133](03-functional-requirements.md)), until the trigger in
[ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md). Even then the first move is a
JavaScript-enhanced page for the one view that needs it, not a framework.

**No on-demand execution, no forced transitions, no history mutation**
([FR-137](03-functional-requirements.md)). The API's prohibitions
([03-api-design.md](../02-architecture/03-api-design.md)) apply to the console unchanged, and the
console has no endpoint the API does not.

**No activity metrics on the effectiveness dashboard.** Runs executed, comments posted and pull
requests opened are *operational* metrics for the operator
([12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)) and are excluded from
the surface a buyer uses to judge value.

**No cross-tenant benchmarking by default**, and no published cross-tenant figure
([FR-138](03-functional-requirements.md)).

**No mobile layout and no browser compatibility matrix**
([04-non-functional-requirements.md](04-non-functional-requirements.md), explicit non-requirements).
The requester's mobile surface is their own chat client, which we do not build.

**No completion estimates or projections** presented as facts
([07-worksites.md](07-worksites.md)).

> **Open question OQ-18** — What the console contains in its **first** version versus later. The page
> set above is the whole; the first version cannot be all of it. Some of it is forced by other choices
> — a hosted deployment needs users, teams and roles on day one, and a worksite is unusable without its
> detail page — and some is genuinely optional at first, notably the findings page (findings are also
> pull-request comments) and the effectiveness dashboard (whose numbers are meaningless until there is
> data). **Blocks:** the console backlog items and their ordering. **Resolved by:** the founder
> choosing, after OQ-01 — because the hosted shape forces more of it than the self-hosted shape does.

> **Open question OQ-23** — Identity for the console: **local accounts, or an identity provider**, and
> whether the hosted deployment requires single sign-on. A hosted multi-tenant service with local
> passwords is a credential-storage obligation nobody wants; requiring an identity provider for a
> self-hosted install is a barrier for a customer who has none. **Blocks:** the authentication module,
> the `users` schema, and part of the bootstrap procedure. **Resolved by:** the founder stating what
> the first deployment's users already have.
