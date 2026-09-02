# Cost control and budget enforcement

The second half of the mechanism for [UF-2](01-system-overview.md#the-five-unforgivable-failures).
The termination guards bound how many times something happens; this document bounds what it costs
and makes the number true.

Design stance: **cost is an invariant to be enforced, not a metric to be observed.** A dashboard
showing that a Run spent too much is a post-mortem. Admission control before the call is the
mechanism.

## The ceiling hierarchy

Checked in order, cheapest first. A Run may lower its own ceiling relative to the Project default but
never raise it above the Project maximum, so a caller with a `submitter` key cannot spend more than the
operator authorised.

| Level | Default | Set by | Exceeded means |
| --- | --- | --- | --- |
| Deployment daily | operator-configured, required at startup | Operator | Refuse new Runs; existing Runs park |
| **Tenant** | required at tenant creation | Operator or platform role | Refuse new work for that tenant. **One tenant MUST NOT be able to exhaust another's capacity** ([FR-119](../01-product/03-functional-requirements.md)) |
| Project | required at registration | Operator | Refuse new Runs on that Project |
| **Worksite** | declared before the worksite becomes active | Whoever declares the worksite | Pause the worksite and escalate. **Not raisable while it is active** ([FR-097](../01-product/03-functional-requirements.md)) |
| Run | Project default, lowerable per request | Submitter, within Project max | Park in `AWAIT_HUMAN(budget_exhausted)` |
| Task | Run ceiling divided by the Task count, with a floor | System at plan acceptance | Fail the Task; escalate |
| **Request** | per-request and per-period allowance in the requester's entitlement | Tenant administrator | Refuse triage with `request_allowance_exhausted` ([FR-110](../01-product/03-functional-requirements.md)) |

The Task ceiling exists so that one pathological Task cannot consume the entire Run and starve the
remaining work. Without it, a Run with eight Tasks can spend everything on Task 1 and report seven
Tasks "not attempted", which is a legible failure but a wasteful one.

**The worksite ceiling exists for the same reason one level up, and it is the more urgent of the two.**
A campaign is a loop above every per-Run bound in this system
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)): forty cycles of twenty slices, each
individually within its Run ceiling, is a spend nobody authorised item by item. Four ceilings — spend,
Run count, duration, and concurrently open pull requests — plus a campaign progress oracle that pauses a
worksite whose measured remaining count is not falling.

**The tenant ceiling exists because of hosted operation**
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). In a self-hosted
deployment it is a formality with one tenant. In a hosted one it is what stops a single tenant's
worksite consuming the deployment.

**The request allowance exists because triage spends money on work that is then declined**
([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). Its volume is set by however many people
are in a channel, which is the first cost in this system that somebody else controls.

## Admission control

Before every model call:

```python
def admit(assembled_prompt: Prompt, tier: Tier, ledger: Ledger) -> Admission:
    estimate = (count_tokens(assembled_prompt, tier.tokeniser) * tier.price_in
                + tier.max_output_tokens * tier.price_out)
    if ledger.task_spent + estimate > ledger.task_ceiling:            return DENY_TASK
    if ledger.run_spent + estimate > ledger.run_ceiling:              return DENY_RUN
    if ledger.worksite_spent + estimate > ledger.worksite_ceiling:    return DENY_WORKSITE
    if ledger.project_spent + estimate > ledger.project_ceiling:      return DENY_PROJECT
    if ledger.tenant_spent + estimate > ledger.tenant_ceiling:        return DENY_TENANT
    if ledger.deployment_spent_today + estimate > ledger.daily_cap:   return DENY_DEPLOYMENT
    return ALLOW
```

**Run creation is admitted before the Run exists**, separately from the per-call check above
([FR-119](../01-product/03-functional-requirements.md)). With four trigger sources, a Run that exists
and cannot proceed is the invisible queue the honest-failure principle forbids: work that was accepted
and is not happening, with nothing to look at. Admission at creation means the trigger is either
enqueued visibly with a cause, or refused with a reason
([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)).

Four properties are non-negotiable, each preventing a specific way this goes wrong:

**The estimate uses the real tokeniser on the assembled prompt**, not a character-count heuristic. A
heuristic that under-estimates by 30% turns a hard ceiling into a soft suggestion, which is the exact
failure the ceiling exists to prevent.

**The estimate assumes maximum output.** Estimating typical output makes the guarantee probabilistic.
The ceiling must hold in the worst case or it is not a ceiling.

**Denial is a state transition, not an exception.** It routes to `AWAIT_HUMAN(budget_exhausted)` with
the ledger attached ([FR-051](../01-product/03-functional-requirements.md)). An exception would be
caught somewhere and turned into a retry, which is how a budget guard becomes a budget multiplier.

**Denial never silently downgrades the tier.** Substituting a cheaper model to fit the budget produces
a worse result that the audit log attributes to the wrong model, and it hides the fact that the Run
was under-funded. The system stops and says so.

## Reconciliation

The estimate is replaced by the provider-reported actual immediately after the call, in the same
transaction as the call's event. Where a provider does not report usage, the tokeniser count of the
prompt plus the completion is recorded and the row is flagged `usage_estimated = true`, so downstream
figures can distinguish measured spend from computed spend rather than quietly averaging the two.

Reconciliation error is bounded by [NFR-009](../01-product/04-non-functional-requirements.md) at
$0.02 per Run. A larger drift means the tokeniser or the price table is wrong, which is a defect
rather than noise — hence a nightly reconciliation between `run_cursor.spent_usd` and the sum over
`llm_calls` (INV-3 in [02-data-model.md](02-data-model.md)).

## Idempotency: never pay twice

Every model call carries `sha256(run_id, task_id, attempt_no, state, effect_index, prompt_hash)`. The
sequence is:

1. Insert an `llm_calls` row in state `pending` with the key. A unique constraint on the key means a
   concurrent or repeated attempt fails here rather than at the provider.
2. Make the call.
3. Update the row to `completed` with actual usage, and append the event, in one transaction.

A crash between 1 and 3 leaves a `pending` row. On resume, the reconciler treats a `pending` row older
than the call timeout as *charged but unknown*: it is counted against the budget (the conservative
direction) and flagged for the operator. The alternative — assuming it did not happen — permits
double spend on every crash, and crashes cluster during exactly the runs that are already expensive.

## Where the money actually goes

Understanding the shape prevents optimising the wrong term.

**Input tokens dominate.** The repo map, the Spec, the Task and the attempt history are re-sent on
every Attempt; the produced patch is small. This is why the context budget
([08-context-and-retrieval.md](08-context-and-retrieval.md)) is a cost mechanism first and a quality
mechanism second.

**Failed Runs are the margin problem.** A Run that burns three Attempts and escalates has spent real
money for a branch nobody merges. `GUARD_PROGRESS` is therefore a cost control as much as a safety
control, and [12-observability-and-slos.md](12-observability-and-slos.md) requires cost-per-failed-Run
as its own metric rather than folding it into an average.

**The vision change added three failed-Run problems in new places**, and each is the same shape:

*A worksite multiplies it by its cycle count.* Twenty slices per cycle of which four fail buys sixteen
pull requests and pays for twenty. The campaign progress oracle is a margin mechanism as much as a
safety one, exactly as `GUARD_PROGRESS` is.

*An unmerged pull request is a total loss.* Worksite progress is measured on merged state
([FR-096](../01-product/03-functional-requirements.md)), so a delivered slice nobody merges cost full
price and produced nothing — and it consumed review attention on top. The maximum-open-pull-requests
ceiling is a cost control disguised as a courtesy.

*A declined request cost something.* Triage and clarification are model calls
([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)), and a decline is a legitimate outcome
that produces no artifact. Its volume is set by channel membership rather than by us, which is why the
per-requester allowance exists.

**Evidence is the most expensive thing the advisory lane does.** An evidence attempt is a model call
that writes code plus a Sandbox execution, several times the cost of a comment
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). A review of a large pull request with
several concerns can cost more than a dependency upgrade, and the ceiling will sometimes cut a review
short — which the reader experiences as an incomplete review rather than as a budget working. That is
recorded as a cost of the decision, not as a defect to be tuned away.

**Planning is cheap; implementation is not.** `SPEC` and `PLAN` are one call each on the expensive
tier. `IMPLEMENT` runs up to twelve times per Run on the mid tier. Tier assignment
([10-llm-integration-and-evaluation.md](10-llm-integration-and-evaluation.md)) follows that
distribution: pay for reasoning where it is called once.

**Sandbox seconds are wall-clock, and wall-clock was dependency installation.** Moving installation to
image build time ([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md)) removes the
largest term. What remains is test execution, bounded by the per-exec timeout.

## Cost levers, in order of effect

1. **Prompt caching through stable prefix ordering** — the single largest lever, and free once the
   assembler is ordered correctly ([08-context-and-retrieval.md](08-context-and-retrieval.md)).
   Tracked as [NFR-013](../01-product/04-non-functional-requirements.md).
2. **Refusing retries that cannot learn** — `GUARD_PROGRESS` converts three expensive failures into
   one.
3. **Tier routing** — navigation, summarisation and log reduction on the cheap tier; only patch
   generation and planning on capable tiers.
4. **Diff-only edits** — output tokens scale with the change, not the file
   ([ADR-0008](../03-adr/0008-search-replace-patch-format.md)).
5. **Verification output truncation** — a failing suite can emit more tokens than the source file; it
   is truncated and normalised before it costs anything.
6. **Local models for the high-volume tier** — where the operator has the hardware, the `EDIT` tier
   can point at a local endpoint and the dominant term goes to zero (subject to OQ-04).

## Reporting

Per Run, always available in the console: total spend, ceiling, spend by State, spend by tier,
cached-token ratio, and Sandbox wall-clock seconds. Per worksite: spend against ceiling, spend per
cycle, and spend per merged pull request. Per request: triage spend against the requester's allowance.
Per deployment, per day: spend, Run count, and **cost per successful Run** alongside **cost per failed
Run** — reported separately, because the average of the two hides the number that determines whether
the product is viable.

**Operational cost reporting and the effectiveness dashboard are different surfaces.** Cost per Run is
for the operator. **Cost per merged pull request** — the same money in the buyer's denominator — is for
the person deciding whether to renew, and it lives on the effectiveness dashboard, per lane and per
class, with the count it was computed from
([01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md),
[FR-130](../01-product/03-functional-requirements.md)). The two must not be conflated: one measures what
we spent, the other what they got.

Unknown values render as "unknown", never as zero
([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)). A cost of zero
means no spend occurred; a cost that could not be determined is a different fact and must look
different. A cost-per-outcome figure over too few outcomes renders as "insufficient data"
([FR-132](../01-product/03-functional-requirements.md)) — a percentage or a unit cost computed from
three samples is the same defect as rendering unknown as zero.

## What is deliberately not built

**No billing, invoicing or plan entitlements.** No pricing decision exists (OQ-06). Note that this is
now **conditionally on the critical path**: hosted operation needs a billing surface to take money at
all, so if OQ-01 resolves to hosted, OQ-06 stops being comfortably deferred
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). Entitlements — who may
invoke what ([FR-107](../01-product/03-functional-requirements.md)) — **are** built, and are an
authorisation mechanism rather than a commercial one.

**No cost prediction before a Run.** Predicting spend for work that has not been decomposed yet would
be a guess presented as a number, which the honest-failure principle forbids. The ceiling is the
commitment; the estimate is not offered. **This extends to a worksite**: a remaining count and a burn
rate invite a completion cost, and any such figure from a handful of cycles is invented. If one is ever
shown it carries the observations behind it ([FR-139](../01-product/03-functional-requirements.md)).

**No automatic tier downgrade under budget pressure.** Explained above: it produces a worse result
attributed to the wrong model.

**No shared budget pool.** Each Project, worksite and tenant ceiling is independent, so one cannot
exhaust another's allowance. A shared pool would reintroduce the coupling the tenant ceiling exists to
prevent.

**No priority spending.** There is no mechanism by which one tenant's or one worksite's work is funded
ahead of another's. The honest version of "this one first" is a higher ceiling and a higher concurrency
cap, both visible in configuration ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)).

**No borrowing across levels.** A worksite that exhausts its ceiling stops; it does not draw on the
Project's remaining allowance, and no ceiling may be raised while it is active
([FR-097](../01-product/03-functional-requirements.md)).
