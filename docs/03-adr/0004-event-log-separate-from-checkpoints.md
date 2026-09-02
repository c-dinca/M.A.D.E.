# ADR-0004 — Our event log is the audit source; framework checkpoints are a resumption cache

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-5, [02-architecture.md](../02-architecture.md)

## Context

LangGraph persists a checkpoint of the graph state at each super-step, and that checkpoint is enough
to resume a Run. It is therefore tempting to treat it as the record of what happened: it is already
written, already durable, and already ordered.

But a checkpoint is a *state snapshot*, not a *history*. It answers "where is this Run" and not "what
did this Run do". The audit consumer — a security reviewer asking which commands executed and where
data could have gone ([UF-5](../02-architecture.md))
— needs the second question answered, and no sequence of snapshots reconstructs it: an execution that
happened between two snapshots and changed nothing visible in state simply is not there.

## Decision

`run_events` is the audit source of truth and the replay source. Framework checkpoints are a
resumption cache with no audit standing.

Concretely: every effect writes an event, in the effect's transaction. Run state is derivable by
folding events ([NFR-016](../03-requirements.md)). Checkpoints MUST NOT be
read by any audit, export, reporting or reconciliation path, and deleting all checkpoints for a
terminal Run MUST NOT lose any information — a property asserted by a test, because it is the cheapest
way to keep the boundary from eroding.

If the two disagree, the event log is right.

## Alternatives considered

### Use checkpoints as the audit record — rejected

The strong case: it is free. The framework already writes them durably and in order, and a Run's
history is recoverable as a sequence of state deltas. No second write path, no risk of the log and the
execution position disagreeing, and lower append volume.

Rejected because the checkpoint's *shape is not ours*. Its schema is defined by the framework and can
change on upgrade, which would break historical audit reads — an audit record we cannot guarantee we
can still parse in a year is not an audit record. State snapshots also omit what did not change state:
a Sandbox execution that produced no state delta, an egress denial, a model call that failed
validation. Those are precisely the events a security reviewer wants. And diffing snapshots to
reconstruct actions is inference, whereas an audit answer must be a record.

### Write both, and reconcile — rejected

The case: use checkpoints where they are convenient and events where they are complete, checking
agreement.

Rejected because two sources that must agree eventually do not, and the reconciliation logic becomes a
third thing to trust. The rule "one is authoritative, the other is disposable" is simpler to hold and
cheaper to test.

## Consequences

### Positive

Audit output is stable across framework upgrades. Deleting checkpoints for terminal Runs is a safe
storage reclamation. Replay is testable against a corpus of real Runs, which turns incidents into
permanent regression tests.

### Negative

Every effect is written twice: once as its own row, once as an event. That is extra write volume on
the hot path and extra code at every effect site, and forgetting the event at a new effect site is a
silent audit gap — which is why the nightly reconciliation in
[NFR-015](../03-requirements.md) exists rather than trusting discipline. The
event schema is now ours to version and evolve compatibly, forever. And there is a standing temptation
to read a checkpoint because it is right there and already parsed; that temptation must be resisted in
review, which is a permanent tax on attention.

## Revisit when

Never for the audit direction — this one is structural. The narrow question worth reopening is whether
checkpoints can be dropped entirely and resumption driven purely from the event fold, which would
remove the duplication. That becomes attractive if fold performance proves adequate at the largest
observed Run size, and it would simplify the model considerably.
