# ADR-0008 — Edits are exact-match search/replace blocks

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** [08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md), [07-cost-control.md](../02-architecture/07-cost-control.md)

## Context

An agent must express a change to a file. The format determines output token cost, the failure mode
when the model is slightly wrong, and how much damage a bad edit does.

Three candidates exist in practice: rewrite the whole file, emit a unified diff, or emit
search-and-replace blocks. The choice matters more than it appears, because it is exercised on every
Attempt of every Task and its failure mode is the most common non-verification failure in the system.

## Decision

Patches are search/replace blocks. The `SEARCH` text MUST match the target file byte-exactly and
uniquely; anything else is a rejection with a structured error naming the file and the nearest
candidate location ([FR-035](../01-product/03-functional-requirements.md)).

There is **no fuzzy matching**, no whitespace-insensitive comparison and no nearest-match application.
A rejection is cheap, structured feedback and counts as an Attempt.

## Alternatives considered

### Whole-file rewrite — rejected

The strong case: the most reliable format for a model to produce. There is no matching step, so it
never fails to apply; the result is always syntactically coherent because the model wrote the whole
thing; and there is no partial-application state. For small files it is simple and robust, and it
removes an entire class of "the patch did not apply" failures.

It lost on cost and on silent regression. Output tokens are the expensive direction, and a rewrite
scales output with file size rather than with change size — on a 500-line file that is two orders of
magnitude more output than the edit warrants, on every Attempt. Worse, a rewrite silently reverts
anything the model did not carry forward: a helper it did not consider important, a comment, an
earlier Task's change. That damage passes verification if the tests do not cover the reverted code,
which makes it a UF-3-adjacent failure that surfaces later and elsewhere.

### Unified diff — rejected

The case: a standard, well-specified format with mature tooling; `git apply` handles it; it is compact;
and models have seen a great deal of it in training. Context lines make it self-validating.

Rejected because line numbers drift. The model's view of the file comes from a `read_range` call that
may be stale by the time it emits the diff, and hunk headers encode absolute positions. The resulting
failure is frequent and confusing: the diff is semantically correct and mechanically unapplicable, and
the model has no good way to recover because it cannot see why. Search/replace moves the anchor from a
position to content, which is the thing the model actually reasoned about.

### Search/replace with fuzzy matching — rejected

The case, and it is tempting: most near-misses are whitespace or an incidental difference, so fuzzy
matching converts a failed Attempt into a successful one and raises the pass rate immediately.

Rejected because the failure mode is corruption rather than rejection. A fuzzy match that lands on the
wrong occurrence edits code the model did not intend to touch, and the result may still pass
verification. That is precisely the silent-wrongness class this system is built to eliminate, and
trading it for a higher pass rate is trading the product's premise for a metric.

## Consequences

### Positive

Output tokens scale with the change, not the file. A stale view produces a clean rejection with
actionable feedback rather than a wrong edit. Reverting unrelated code becomes structurally
impossible — text not in a block is untouched. Application is deterministic and unit-testable without
a model.

### Negative

Application failures are common and cost an Attempt each: a model that reproduces indentation
imperfectly, or that anchors on a non-unique fragment, fails. That consumes attempt budget on a
formatting problem rather than a reasoning problem, and it will be a visible share of early failures.
The prompt must carry format instructions and examples, spending prefix tokens on every call. Large
structural refactors are awkward to express as blocks and may need several Tasks. And the parser is
ours to write and harden — malformed block markers, nested markers and encoding edge cases are all our
problem, where `git apply` would have been someone else's.

## Revisit when

Measured Attempt failures attributable to patch application exceed 20% of all failed Attempts in the
evaluation harness. The response is better prompt examples and a stricter `read_range` contract first;
only if that fails should the format be reopened — and fuzzy matching stays rejected regardless,
because its cost is correctness rather than convenience.
