# Business model

The intake did not supply pricing, budget or market figures, and inventing them would poison every
decision downstream. This document therefore specifies the **structure** of the model — who pays,
what the cost drivers are, how the unit economics are computed, and what makes the position
defensible — and marks each missing number as an open question with the work it blocks. The formulas
here are normative: the instrumentation in
[02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md) exists to populate them.

## Who pays, and for what

The buyer is an engineering organisation that already has production systems and a security review
process. The purchase is authorised by an engineering leader, but it is **vetoed by security**, which
means the security posture is not a feature that increases willingness to pay — it is the condition
of the sale happening at all. That asymmetry is why the roadmap sequences the isolation boundary
before the multi-agent capability ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)).

The daily user is a developer or lead who submits requests and reviews the resulting branches. They
are not the budget holder. The consequence for the product is that per-run cost must be legible to
someone who is not watching it: the ceiling is declared up front and the ledger is per run, not a
monthly aggregate that arrives as a surprise.

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

Whichever is chosen, one rule is already settled and is a positioning commitment: **we do not bill
for autonomous compute consumed**. The intake identifies usage-metered agent billing as a specific
customer grievance — a reasoning error becomes a bill — and a pricing model that reproduces it
discards the differentiator.

> **Open question OQ-06** — Pricing structure and price point. **Blocks:** any billing surface, the
> `plans`/entitlement concept in the schema, and any published unit-economics claim. Nothing in the
> v1 backlog depends on it, which is deliberate: v1 has no billing code
> ([01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md)). **Resolved by:**
> two design-partner conversations establishing what budget line this comes from and what it is
> compared against.

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

In a self-hosted deployment the customer bears both terms directly. Our marginal cost is support.
That is favourable for a bootstrapped company and it is another argument for the self-hosted shape in
[ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md).

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
A competitor can copy an architecture in a week; they cannot copy a year of recorded failures.

**The security evidence compounds.** An escape suite with a case for every incident, plus a run log
that answers auditor questions, is what converts a security veto into an approval. Each customer's
review adds cases that make the next review shorter.

**Deployment inside the perimeter compounds.** Once the system runs on the customer's hardware with
their model endpoints and their pipeline conventions, replacing it means repeating their security
review. That is switching cost earned by architecture rather than by lock-in.

**Model quality does not compound.** It is rented, it changes monthly, and every competitor rents
from the same shelf. The architecture therefore treats models as swappable
([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)) and puts no strategic weight on
any specific one.

## Business risks with an engineering response

| Risk | Why it bites | Engineering response |
| --- | --- | --- |
| Model capability improves until orchestration looks redundant | A single strong model with a long context may solve the tasks v1 decomposes | The moat is isolation, verification and audit, none of which a better model provides. Keep the orchestration layer thin so a better model reduces our cost rather than our relevance. |
| Success rate too low to be worth reviewing | If a human must fix most output, the buyer is paying for supervision | Gate the roadmap on measured golden-task pass rate; narrow to task classes with strong oracles rather than broaden ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md), kill criteria) |
| Model prices or availability shift | Margin and feasibility both move | Tiered abstraction, two configured providers per tier, cost recorded per call so a re-price is a config change with a measurable effect |
| Security incident at a design partner | Existential for a security-positioned product | Escape suite as a release gate; incident response and disclosure posture in [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md) |
| Solo-founder capacity | Every operational surface is paid for in the founder's attention | Boring infrastructure as a design principle ([02-architecture/01-system-overview.md](../02-architecture/01-system-overview.md)), capped alert budget, no Kubernetes |
