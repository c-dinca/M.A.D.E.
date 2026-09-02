# Business model

The intake did not supply pricing, budget or market figures, and inventing them would poison every
decision downstream. This document therefore specifies the **structure** of the model — who pays,
what the cost drivers are, how the unit economics are computed, and what makes the position
defensible — and marks each missing number as an open question with the work it blocks. The formulas
here are normative: the instrumentation in
[02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md) exists to populate them.

## Who pays, and for what

Sharpened by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): the buyer is
an engineering organisation carrying a maintenance burden it cannot staff economically, and the clearest
version of that buyer is a software services or outsourcing organisation — the intake names the
Bucharest and Cluj hubs.

> **Broadened by the 2026-09 vision change, and one clause below is now conditional.** The advisory
> lane, worksites and the chat front door widen the buyer beyond the organisation whose contracts
> forbid sending source to a third party — a company with a stalled migration, a review bottleneck or
> a queue of requests from non-developers has the same budget line and none of the perimeter
> constraint. Whether the perimeter argument still leads is **OQ-15**. Whether the first paying
> deployment is hosted or self-hosted is **OQ-01**, and it changes the economics below materially:
> hosted operation means our marginal cost is compute and tokens rather than support alone, and it
> makes usage-based billing technically possible for the first time.

Their economics are people-hours, and maintenance work sits in the worst quadrant of those economics:
contractually required, low-margin because a client will not pay senior rates for a package bump, hard
to staff because nobody wants the work, and multiplied across every client repository they hold. That
is a budget line with a number attached and an owner who feels it monthly — persona P4 in
[01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md).

Two consequences that change the shape of the sale relative to the original framing:

**Security stops being a veto and becomes a contract clause — for the self-hosted shape.** An
outsourcing organisation cannot send a client's source to a third party because the client agreement
forbids it. That is a yes-or-no condition satisfied by construction by a self-hosted deployment
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)), not an argument to be
won with a CISO. It is a materially easier conversation. **It is unavailable in the hosted shape**,
where we hold the source and the conversation is the harder one again — which is one of the things
OQ-01 decides.

**The value is denominated in numbers the buyer already tracks**, and they are now reported rather
than asserted. The headline is still the share of pull requests merged without a human editing the
diff. The effectiveness dashboard adds cost per merged pull request, human intervention rate and time
from request to merge, per lane and per class, computed from the event log by published queries
([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). This is the renewal instrument and it
is also the kill-criteria instrument ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)) — the
same numbers decide whether the customer keeps paying and whether we keep building.

**The advisory lane's value is real and soft, and that is a pricing problem rather than a design
problem.** [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) rejected a review
bot as the v1 product partly because "nobody can tell you what a comment was worth". The evidence
requirement improves this — a failing test that demonstrates a bug has a defensible value — but it
does not solve it, and advisory acceptance rate is a weaker commercial argument than a merge rate.
Advisory work should not be expected to carry the price.

The daily user is the lead developer who reviews and merges. They are not the budget holder. So cost
must be legible to someone who is not watching: ceilings are declared up front at four levels —
deployment, tenant, project, worksite — and the ledger is per Run, never a monthly aggregate that
arrives as a surprise. A worksite makes this sharper, because a campaign is exactly the spend nobody
authorised item by item.

## Pricing shape

Two candidate structures. The specification does not force a choice, but it does force the
instrumentation that makes either measurable.

A **per-deployment licence** — an annual fee for the right to run the system on the customer's own
hardware — matches the self-hosted, air-gapped positioning, keeps our marginal cost near zero because
the customer pays for their own compute and model tokens, and avoids the metered-billing failure the
intake identifies in competitors. Its weakness is that value is decoupled from usage, so a customer
running one run a month pays the same as one running a thousand.

A **per-accepted-outcome fee** — charging when a run produces a branch a human approves — aligns
price with delivered value and is the honest inverse of usage-metered billing, since a failed run
costs the customer nothing. Its weakness is that it requires us to observe the customer's approvals,
which is in tension with the air-gapped promise, and it exposes us to their acceptance standards.

[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) narrows this in one respect
worth recording: because the work is recurring and each job is individually small, **volume has to carry
the model**. A package upgrade is worth less than a feature, so price is pressed from below by free
tools and from above by the modest size of the job. That makes per-Run cost control a commercial
necessity rather than a safety feature, and it favours the per-deployment licence — a licence is
indifferent to how many small jobs run, where a per-outcome fee on cheap outcomes collects little while
bearing all the cost.

Whichever is chosen, one rule is already settled and is a positioning commitment: **we do not bill
for autonomous compute consumed**. The intake identifies usage-metered agent billing as a specific
customer grievance — a reasoning error becomes a bill — and a pricing model that reproduces it
discards the differentiator. Note that the per-accepted-outcome structure is *not* usage-metered
billing: a failed Run costs the customer nothing under it, which is the honest inverse.

> **Sharpened by the 2026-09 vision change.** Hosted operation
> ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) removes the technical
> objection to the per-accepted-outcome structure — we can observe merges in a deployment we run — and
> introduces a cost we did not have, because hosted tenants' compute and tokens are ours. It also makes
> OQ-06 urgent rather than comfortably deferred: a hosted deployment needs a billing surface to take
> money at all, so if OQ-01 resolves to hosted, OQ-06 moves onto the critical path. The per-deployment
> licence remains indifferent to volume, which continues to favour it for the self-hosted shape.
>
> Two further pricing units now exist and neither is priced here: a **worksite**, which is a bounded
> campaign with a declared ceiling and a measurable outcome and is therefore the most naturally
> priceable object in the product; and **advisory** work, whose value is soft for the reason above.
> Nothing is asserted about either, because no material has been supplied to support it.

> **Open question OQ-06** — Pricing structure and price point. **Blocks:** any billing surface, the
> `plans`/entitlement concept in the schema, and any published unit-economics claim. Whether it blocks
> a v1 milestone now depends on OQ-01: it does not for a self-hosted first deployment, and it does for
> a hosted one. **Resolved by:** two design-partner conversations establishing what budget line this
> comes from and what it is compared against.

## Unit economics: the formula, not the number

Cost per run is dominated by two terms, both instrumented from the first milestone so the number is
measured rather than estimated:

```
run_cost = model_cost + sandbox_cost

model_cost   = Σ over llm_calls of (tokens_in_uncached × price_in
                                  + tokens_in_cached   × price_in_cached
                                  + tokens_out         × price_out)

sandbox_cost = sandbox_wall_seconds × host_cost_per_second
```

Three properties of this formula drive engineering decisions:

The **failed-run cost** is the one that determines viability, not the successful-run cost. A run that
burns three attempts and escalates to a human has spent real money and produced a branch nobody
merges. This is why the progress oracle exists — refusing a retry that cannot learn anything is
directly a margin mechanism, not only a safety one — and why
[02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)
requires cost-per-failed-run as a first-class metric rather than an aggregate.

**Input tokens dominate output tokens**, because the repo map, the task and the attempt history are
re-sent on every attempt while the produced patch is small. That is the entire justification for the
context budget and cache-ordering rules in
[02-architecture/08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md).

**Sandbox cost is wall-clock, and wall-clock is dominated by dependency installation**, not by
computation. Baking dependencies into a pinned image converts a recurring per-run cost into a
one-off per-image cost, which is a second, independent reason for
[ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md) beyond its security rationale.

In a self-hosted deployment the customer bears both terms directly and our marginal cost is support.
In a hosted deployment we bear both, so gross margin becomes a function of the two formulas above
rather than of support capacity alone — which is the largest single economic consequence of
[ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md).

Two new cost terms arrive with the vision change and both need naming so they are not discovered
later.

**A worksite multiplies the failed-Run term by its cycle count.** A campaign that produces twenty
slices per cycle, of which four fail, has bought sixteen pull requests and paid for twenty. The
worksite progress oracle and the four worksite ceilings
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)) are the mechanisms that bound this,
and they are margin mechanisms as much as safety ones — the same argument that justifies
`GUARD_PROGRESS`.

**Advisory work has a cost and no guaranteed outcome.** An evidence attempt is a model call that writes
code plus a Sandbox execution ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)), and a
declined chat request has a triage cost and produces nothing
([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). Both are the failed-Run margin problem
in new places, and the second scales with however many people are in a channel.

> **Open question OQ-04** — The infrastructure budget ceiling and whether GPU hardware suitable for
> local inference already exists on the founder's Proxmox estate. **Blocks:** whether the default
> configuration ships with a local endpoint as the `EDIT` tier (which would make the free-iteration
> strategy real) or requires a paid endpoint for every tier, and therefore what the smoke-test cost
> in [05-delivery/04-definition-of-done.md](../05-delivery/04-definition-of-done.md) can assume.
> **Resolved by:** the founder stating available VRAM and monthly infrastructure ceiling.

## Defensibility

Three assets compound, and one does not.

**The evaluation corpus compounds.** Golden tasks, adversarial repositories, and recorded failure
signatures accumulate into a regression suite that is expensive to reproduce and that directly
governs how safely prompts and models can be changed
([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)).
A competitor can copy an architecture in a week; they cannot copy a year of recorded failures. The
advisory lane extends this and depends on it more heavily, because acceptance and dismissal of findings
over time is the *only* quality signal that lane has
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)).

**The security evidence compounds.** An escape suite with a case for every incident, plus a run log
that answers auditor questions, is what converts a security veto into an approval. Each customer's
review adds cases that make the next review shorter.

**Deployment inside the perimeter compounds.** Once the system runs on the customer's hardware with
their model endpoints and their pipeline conventions, replacing it means repeating their security
review. That is switching cost earned by architecture rather than by lock-in. It applies to the
self-hosted shape only, and is one of the things OQ-01 and OQ-15 decide the weight of.

**A worksite in progress compounds, and it is the strongest switching cost in the product.** A
half-finished migration with a measured remaining count, a slice plan and weeks of recorded cycles is
not something a customer abandons to try a competitor. This was not available before the vision change
and it is worth more than the security review, because it is earned by delivering rather than by
being installed.

**Model quality does not compound.** It is rented, it changes monthly, and every competitor rents
from the same shelf. The architecture therefore treats models as swappable
([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)) and puts no strategic weight on
any specific one.

## Business risks with an engineering response

| Risk | Why it bites | Engineering response |
| --- | --- | --- |
| Model capability improves until orchestration looks redundant | A single strong model with a long context may solve the tasks v1 decomposes | The moat is unattended execution, enforced budgets and audit, none of which a better model provides. Keep the orchestration layer thin so a better model reduces our cost rather than our relevance. |
| The interactive tools are judged "good enough" | Claude Code and Cursor are free or cheap, improve faster than one person can, and their threat model — the agent has the developer's own privileges — is already accepted by most buyers | Compete on shape, not capability: they assume a human at the keyboard, and maintenance work is unattended, scheduled and high-volume. If a buyer says "we already have that", the disqualifying question is whether they run agents *unattended* with a budget cap and an audit trail ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)) |
| The repositories that need this most benefit least | Severe technical debt correlates with a weak test suite, and a weak suite is a weak oracle | No engineering fix exists. Qualify honestly at registration ([FR-004](../01-product/03-functional-requirements.md)) and treat suite strength as a sales qualification question, not a support problem |
| Success rate too low to be worth reviewing | If a human must fix most output, the buyer is paying for supervision | Gate the roadmap on measured acceptance rate and intervention rate; narrow to classes with strong oracles rather than broaden ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md), kill criteria) |
| Model prices or availability shift | Margin and feasibility both move | Tiered abstraction, two configured providers per tier, cost recorded per call so a re-price is a config change with a measurable effect |
| Security incident at a design partner | Existential for a security-positioned product, and a **cross-tenant** breach in the hosted shape rather than a single-customer one | Escape suite as a release gate; incident response and disclosure posture in [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md); the boundary adequate for multi-tenant execution is OQ-10 and is not assumed |
| Solo-founder capacity | Every operational surface is paid for in the founder's attention, and the vision change added several | Process-kind and alert ceilings held rather than relaxed ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)); server-side rendering retained ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)); OQ-01 forces one deployment shape to be first rather than both at once |
| The advisory lane produces volume nobody values | Findings a reviewer dismisses cost attention and return nothing, which is the failure mode of the category | Evidence requirement plus a measured acceptance rate and evidence ratio per class ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)); narrow the class rather than lower the requirement |
| Merge capacity, not our throughput, becomes the limit | Worksite progress is measured on merged state, so a slow reviewer stalls a campaign that is working ([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)) | No engineering fix. Work in flight and intervention rate are reported separately so the constraint is visible and attributable rather than blamed on the system |
| Scope grew faster than one maintainer can build it | Six new capabilities arrived at once, and each is individually defensible | The roadmap is re-derived into small independently demonstrable milestones, and OQ-11 to OQ-13 force one first worksite, one first advisory class and one scale target rather than all of them ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)) |
