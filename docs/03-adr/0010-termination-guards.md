# ADR-0010 — Six layered termination guards, including a progress oracle

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-2, [02-architecture.md](../02-architecture.md)

## Context

The intake's plan for loop prevention is a `retry_count` capped at three, which is the standard
approach and is genuinely necessary. It is also insufficient, and understanding why determines the
whole shape of the cost story.

A cap of three bounds the *number* of attempts but not their cost or their value. Three attempts on
the expensive tier against a large prompt is real money, and if all three produce the identical patch
or fail identically, the system has paid three times for one piece of information. The failure the
intake describes — an agent burning budget while making no progress — happens comfortably inside a
retry cap.

## Decision

Six independent guards, all deterministic, all pure functions over data already recorded:

| Guard | Bounds |
| --- | --- |
| `GUARD_PLAN_VALID` | Work that cannot be verified never enters the queue |
| `GUARD_ATTEMPT_CAP` | Attempts per Task (default 3) and per Run (default 12) |
| `GUARD_PROGRESS` | A retry is legal only if the previous one produced new information |
| `GUARD_CYCLE` | A repeated `(state, task, tree hash, inputs)` tuple stops the Run |
| `GUARD_BUDGET` | Pre-flight admission against Task, Run, Project and deployment ceilings |
| `GUARD_PATCH_POLICY` | Patches cannot touch CI configuration, hooks, submodules or paths outside the workspace |

Plus a wall-clock TTL delivered as an event rather than evaluated in a router.

`GUARD_PROGRESS` is the addition that matters. A retry is refused when the new Attempt has an identical
patch hash to any previous Attempt, or an identical normalised failure signature with no reduction in
failing count relative to the previous Attempt. Every failure path terminates in `AWAIT_HUMAN` or a
terminal State; **no failure handler routes back to itself**.

## Alternatives considered

### An attempt cap alone, as the intake proposes — rejected

The strong case: it is simple, it is obviously correct, it cannot itself be buggy in a way that lets a
loop through, and it is trivially explainable to a customer. Every additional guard is code that can
have its own defects, and a guard that wrongly refuses a retry costs a Run that would have succeeded.
There is a real argument that three attempts is cheap enough that sophistication is not worth it.

It lost because the cap does not bound the thing that matters. Three identical expensive failures is
the observed pathology, not an exotic one: a model that misreads the failure output produces the same
patch repeatedly, and each repetition costs full price. It also lost on signal quality — a Run that
stops after one useless retry with "no progress between attempts" is far more actionable for the human
than one that stops after three with three identical traces.

### Model-judged progress ("ask the model whether it is making progress") — rejected

The case: the model has more context about whether an approach is promising than a hash comparison
does, and an LLM judge could permit a retry that looks identical mechanically but is a genuinely
different approach.

Rejected because it puts the termination guarantee under the control of the thing being guarded, and
because a model that is looping is exactly the model least able to notice. It also costs a call per
evaluation, so the guard against spending would itself spend.

### A hard wall-clock or spend limit only, with unlimited attempts — rejected

The case: the only thing anyone actually cares about is the bill and the time, so bound those directly
and let the system attempt as many times as fits. Simpler, and it never refuses a retry that might
have worked.

Rejected because it wastes the entire budget before stopping, and because it produces no diagnostic. A
Run that spends its ceiling on twenty identical failures tells the human nothing, where one that stops
after two says precisely what happened.

## Consequences

### Positive

Unbounded spend is structurally impossible rather than unlikely: five independent bounds must all fail
simultaneously. Failures are cheap and legible, which is the product's differentiator
([NFR-012](../03-requirements.md)). Guards are pure functions over recorded
data, so they are exhaustively unit-testable without a model or a database.

### Negative

**`GUARD_PROGRESS` will sometimes refuse a retry that would have succeeded** — a model that produces a
near-identical patch with one meaningful change is stopped, and that is a real cost in pass rate paid
for predictability. The guard's correctness depends entirely on the normaliser: an under-normalised
signature makes every attempt look novel and the guard becomes decorative, while an over-normalised
one collapses distinct failures and stops too early. That single function is now load-bearing and must
have exactly one implementation. Six guards is six things to understand before changing routing, which
raises the barrier for a new agent. And each guard trip is a Run that stopped, so the escalation rate
is higher than a system without them — which is correct, but it looks worse in a demo.

## Revisit when

Evaluation shows `GUARD_PROGRESS` refusing retries that a controlled comparison proves would have
succeeded, in more than 10% of the Tasks it stops. The response is to refine the progress vector — for
example by including a normalised structural distance between patches rather than only an equality
check — not to remove the guard.
