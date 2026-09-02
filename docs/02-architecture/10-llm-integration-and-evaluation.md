# LLM integration and evaluation

Models are rented capability. They change monthly, every competitor rents from the same shelf, and no
strategic weight rests on any specific one
([00-context/04-business-model.md](../00-context/04-business-model.md)). The architecture therefore
treats a model as a configured endpoint behind a capability tier, and treats *knowing whether a change
helped* as the durable asset.

## Capability tiers

Calling code names a tier, never a model
([FR-047](../01-product/03-functional-requirements.md)). A grep for a vendor name outside
`made/llm/providers/` is a review-blocking defect.

| Tier | Used by | Selection criterion | Call volume |
| --- | --- | --- | --- |
| `PLAN` | `SPEC`, `PLAN`, escalated review | Best available reasoning and instruction-following | Low: one or two per Run |
| `EDIT` | `IMPLEMENT` for every Task kind | Best patch accuracy per unit cost | High: up to the attempt cap per Task |
| `NAV` | Retrieval triage, log summarisation, commit messages, ambiguity scoring | Cheapest model that reliably follows a schema | Medium |
| `CRITIC` | `REVIEW`, and only after a gate failure | Strong reasoning, low volume | Low, and never on the happy path |

The mapping to distribution is the cost strategy: pay for reasoning where it is called once, and put
the volume workhorse on the tier where a local endpoint can plausibly serve it. Tiers are configured
per Project, which makes cost a dial the operator can turn without touching code.

**There is no built-in default model.** The system refuses to start if a tier is unconfigured
([FR-046](../01-product/03-functional-requirements.md)). A default would silently bind us to a vendor
and would produce a surprise bill on first run.

> **The 2026-09 vision change puts pressure on this, and the pressure should be visible.** One of the
> two original reasons for the rule was that a default "would be wrong for an air-gapped customer", and
> air-gapped operation has moved to deferred scope
> ([01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md)). More directly: a **hosted**
> deployment where every tenant must supply their own model endpoint is a strange product, and a hosted
> deployment that supplies one has a built-in default by another name.
>
> **The rule is unchanged and the question is recorded rather than answered** as **OQ-14**. The
> surviving reason is sufficient on its own: a system that starts with a model nobody chose spends
> money nobody authorised, which is [UF-2](01-system-overview.md#the-five-unforgivable-failures) at
> startup.
>
> **Note what is already settled and is not part of OQ-14.** Pluggability is decided
> ([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)): calling code names a tier, one
> OpenAI-compatible adapter serves hosted and local endpoints, and **a customer's own model endpoint is
> supported by construction**. The open part is narrower and commercial.

## Provider abstraction

One internal client, one interface, whatever is behind it:

```
LLMClient.complete(tier, messages, schema, max_output_tokens, idempotency_key) -> Completion
```

The client owns tier resolution, admission control ([07-cost-control.md](07-cost-control.md)),
tokenisation, structured-output enforcement, metering, retry and fallback. Nothing else in the codebase
talks to a provider.

Providers are adapters implementing a narrow protocol. v1 ships an OpenAI-compatible chat-completions
adapter, because it is the interface both hosted vendors and local servers (Ollama, vLLM,
llama.cpp-based servers) expose, and one adapter therefore covers hosted and air-gapped deployments
without a second code path. Vendor-native adapters are added only when a required capability — prompt
caching semantics, or a structured-output mode — is not reachable through the compatible surface, and
that addition needs a note in the ADR rather than a quiet new module.

Every call records provider, model identifier (pinned, including any version suffix), tier, prompt
version, whether the fallback was used, and whether usage figures were reported or estimated
([FR-050](../01-product/03-functional-requirements.md)). Without the pinned identifier a silent
vendor-side model update is indistinguishable from a regression in our prompts, and the evaluation
harness would attribute the change to the wrong cause.

## Structured output

Every agent returns a schema-validated artifact. The client requests structured output natively where
the provider supports it and validates locally regardless — a provider claiming schema conformance is
not evidence of it.

On a validation failure: one repair attempt with the validation error appended, then the State fails
([FR-052](../01-product/03-functional-requirements.md)). There is no "please fix your JSON"
conversation. A model that cannot produce the schema in two attempts is the wrong model for the tier,
and the failure should surface as a signal rather than be absorbed as cost.

## Degraded modes

Every dependency needs a specified degradation
([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)).

| Condition | Behaviour |
| --- | --- |
| Primary endpoint returns a retryable error | Bounded retry with jitter, then the tier's configured fallback; the fallback is recorded on the call |
| Both endpoints unavailable | Park the Run in `AWAIT_HUMAN(provider_unavailable)`. Never substitute another tier's model, because the result would be attributed to a model that did not produce it |
| Endpoint returns a malformed or truncated completion | Treated as a schema failure: one repair, then fail the State |
| Local endpoint is slower than the timeout | Per-tier timeout applies; a timeout is an availability failure, not a Task failure, and does not consume a Task Attempt |
| Provider reports no usage figures | Record tokeniser-computed values with `usage_estimated = true` so measured and computed spend stay distinguishable |
| Rate limited | Retry with backoff within the effect budget, then park. Never drop to a cheaper tier to get through |

## Prompt management

Prompts are files under `made/agents/prompts/`, versioned by content hash plus a human-readable
version string, and the version is recorded on every call
([FR-053](../01-product/03-functional-requirements.md)). They are assembled by the budgeted, cache-
ordered assembler in [08-context-and-retrieval.md](08-context-and-retrieval.md) — never by string
concatenation at a call site, because an ad-hoc prompt bypasses both the token budget and the cache
prefix ordering, and the second failure is invisible until the bill arrives.

A prompt change is a code change: it goes through review and must clear the evaluation gate below.

## Evaluation harness

Without this, every prompt and model change is anecdote, and "we switched to a cheaper model" quietly
becomes "we increased average attempts by one and doubled cost". The harness is the mechanism that
makes improvement measurable and the corpus that makes it defensible.

**Golden task suite.** Twenty to thirty tasks across at least three seed repositories, each with a
committed expected outcome, organised in tiers:

| Tier | Content | Asserts |
| --- | --- | --- |
| `trivial` | Single-file changes with an obvious oracle | Baseline capability; gates the roadmap via [NFR-026](../01-product/04-non-functional-requirements.md) |
| `multi_file` | Changes spanning two or three files with a real dependency between them | Retrieval and planning quality |
| `ambiguous` | Requests missing a decision the Architect cannot infer | Escalation rather than guessing ([FR-029](../01-product/03-functional-requirements.md)) |
| `unsatisfiable` | Requests that cannot be met | Termination within the cap and under a fraction of the ceiling ([NFR-012](../01-product/04-non-functional-requirements.md)) |
| `adversarial` | Repositories containing prompt-injection text in READMEs, test docstrings and comments | No tool call outside the State's authority ([NFR-028](../01-product/04-non-functional-requirements.md)) |
| `advisory` | Pull requests with known defects, and pull requests with **no** defect | That a finding's recorded `evidence_state` matches whether an evidence record was produced; that no finding is emitted with neither evidence nor a label; and that a clean pull request produces no fabricated finding ([FR-148](../01-product/03-functional-requirements.md), [FR-149](../01-product/03-functional-requirements.md)) |
| `chat_triage` | Messages that map cleanly to a class, messages that map to no class, ambiguous messages, and messages containing injection text | That an unmatched message is declined with the correct reason rather than brokered; that ambiguity is declined rather than inferred; that the clarification allowance is never exceeded; and that no request is created outside the requester's entitlement ([FR-108](../01-product/03-functional-requirements.md), [FR-111](../01-product/03-functional-requirements.md)) |

The tiers that distinguish this product are not an afterthought: `unsatisfiable` measures the
honest-failure loop, `adversarial` measures the authority model, and the two added by the vision change
measure the two new places the system can lie.

**What the `advisory` tier can and cannot measure is worth stating plainly.** It can assert mechanical
properties: that the evidence state matches reality, that nothing was suppressed, that a clean pull
request produces no invented finding. It **cannot** assert that a finding was worth making. That
requires human acceptance over time
([NFR-031](../01-product/04-non-functional-requirements.md), `TBD`), which is a property of work with no
oracle rather than a gap in the harness
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)). The harness measures the floor; the
dashboard measures the value.

**Measures.** Per configuration: pass rate by tier, mean and p95 cost per Run, mean Attempts per Task,
escalation rate, p95 duration, cached-token ratio, and count of authority violations (which must be
zero).

**Baselines.** Results are written as a machine-readable baseline artifact
([FR-077](../01-product/03-functional-requirements.md)) and committed. A pull request touching a
prompt, a tier assignment or a retrieval rule must show the comparison, and CI blocks a regression
beyond the margin in [NFR-027](../01-product/04-non-functional-requirements.md).

**Determinism.** Model output is not deterministic even at temperature zero, so the harness runs each
task a fixed number of times (default 3) and reports the distribution. A single-run comparison would
produce noise indistinguishable from signal, and decisions would be made on it.

**Cost.** A full harness run costs real money on hosted tiers. It runs nightly and on demand, not per
commit; per-commit CI runs the fast deterministic suites only
([04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md)).

## Model selection

> **Open question OQ-14** — Whether a **hosted** deployment offers a managed model endpoint as its
> default, and if so how [FR-046](../01-product/03-functional-requirements.md)'s no-default-model rule
> is honoured. Requiring every hosted tenant to supply their own endpoint is a strange product;
> supplying one is a built-in default by another name, and it makes model cost our cost rather than
> theirs ([00-context/04-business-model.md](../00-context/04-business-model.md)). A third option exists
> and is not chosen here: a per-tenant configured endpoint that we operate but that the tenant must
> explicitly select, which honours the rule in letter and in spirit but is a configuration step at
> signup. **Blocks:** the hosted onboarding flow, the shape of the tenant configuration record, and the
> hosted margin model. Does **not** block anything self-hosted, and does not reopen pluggability, which
> [ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md) settled. **Resolved by:** the
> founder deciding, after OQ-01.

> **Open question OQ-05** — Which concrete model and endpoint each tier uses, and at what price. The
> intake proposes specific hosted and local models; those figures are recorded as unverified in
> [00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified)
> and no decision here depends on them. **Blocks:** the example configuration file and any published
> cost-per-run figure. Does **not** block implementation, because tier assignment is configuration.
> **Resolved by:** running the golden suite against two candidates per tier and recording measured
> pass rate and cost — which is exactly what the harness exists to do, so this question resolves
> itself as a by-product of the milestone that builds it.

## What is deliberately not built

**No fine-tuning or model hosting by us.** Rented capability, no compounding advantage, and
substantial operational cost.

**No prompt-optimisation loop.** Automatically rewriting prompts against the eval suite overfits to
thirty tasks and produces prompts nobody can reason about.

**No multi-model voting or self-consistency.** It multiplies cost by the sample count for a modest
accuracy gain, and the verification oracle already provides a stronger and cheaper correctness signal
than agreement between samples.

**No agent-selected models.** An agent choosing its own model chooses its own cost, which puts the
budget under the control of the thing the budget exists to bound.

**No streaming completions.** The system consumes complete structured artifacts; a partial artifact has
no use, and streaming complicates metering and idempotency for no user-visible benefit.
