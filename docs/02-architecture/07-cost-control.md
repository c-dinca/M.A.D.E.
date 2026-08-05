# Cost control and budget enforcement

The second half of the mechanism for [UF-2](01-system-overview.md#the-five-unforgivable-failures).
The termination guards bound how many times something happens; this document bounds what it costs
and makes the number true.

Design stance: **cost is an invariant to be enforced, not a metric to be observed.** A dashboard
showing that a Run spent too much is a post-mortem. Admission control before the call is the
mechanism.

## The ceiling hierarchy

Four levels, checked in order, cheapest first. A Run may lower its own ceiling relative to the
Project default but never raise it above the Project maximum, so a caller with a `submitter` key
cannot spend more than the operator authorised.

| Level | Default | Set by | Exceeded means |
| --- | --- | --- | --- |
| Deployment daily | operator-configured, required at startup | Operator | Refuse new Runs; existing Runs park |
| Project | required at registration | Operator | Refuse new Runs on that Project |
| Run | Project default, lowerable per request | Submitter, within Project max | Park in `AWAIT_HUMAN(budget_exhausted)` |
| Task | Run ceiling divided by the Task count, with a floor | System at plan acceptance | Fail the Task; escalate |

The Task ceiling exists so that one pathological Task cannot consume the entire Run and starve the
remaining work. Without it, a Run with eight Tasks can spend everything on Task 1 and report seven
Tasks "not attempted", which is a legible failure but a wasteful one.

## Admission control

Before every model call:

```python
def admit(assembled_prompt: Prompt, tier: Tier, ledger: Ledger) -> Admission:
    estimate = (count_tokens(assembled_prompt, tier.tokeniser) * tier.price_in
                + tier.max_output_tokens * tier.price_out)
    if ledger.task_spent + estimate > ledger.task_ceiling:        return DENY_TASK
    if ledger.run_spent + estimate > ledger.run_ceiling:          return DENY_RUN
    if ledger.project_spent + estimate > ledger.project_ceiling:  return DENY_PROJECT
    if ledger.deployment_spent_today + estimate > ledger.daily_cap: return DENY_DEPLOYMENT
    return ALLOW
```

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

Per Run, always available and shown in the viewer: total spend, ceiling, spend by State, spend by
tier, cached-token ratio, and Sandbox wall-clock seconds. Per deployment, per day: spend, Run count,
success rate, and **cost per successful Run** alongside **cost per failed Run** — reported separately,
because the average of the two hides the number that determines whether the product is viable.

Unknown values render as "unknown", never as zero
([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)). A cost of zero
means no spend occurred; a cost that could not be determined is a different fact and must look
different.

## What is deliberately not built

**No billing, invoicing or plan entitlements.** No pricing decision exists (OQ-06) and self-hosted v1
has nobody to bill through the software.

**No cost prediction before a Run.** Predicting spend for a request the Architect has not decomposed
yet would be a guess presented as a number, which the honest-failure principle forbids. The ceiling is
the commitment; the estimate is not offered.

**No automatic tier downgrade under budget pressure.** Explained above: it produces a worse result
attributed to the wrong model.

**No shared budget pool across Projects.** Each Project's ceiling is independent, so one Project
cannot exhaust another's allowance. A shared pool is a v2 concern that arrives with multi-tenancy.
