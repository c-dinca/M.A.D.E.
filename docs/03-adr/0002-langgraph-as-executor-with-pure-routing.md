# ADR-0002 — LangGraph executes the graph; routing predicates remain pure and ours

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-2, UF-5, [02-architecture.md](../02-architecture.md)

## Context

The system needs a graph executor with durable checkpointing and a human-interrupt mechanism, and it
needs termination to be a property rather than an emergent behaviour
([UF-2](../02-architecture.md)). It also needs Runs
to be explainable and replayable after the fact
([UF-5](../02-architecture.md)).

These two needs pull in opposite directions. A framework gives durable execution and interrupts for
free, and costs control over how decisions are made and persisted. Writing it ourselves gives total
control and costs us the debugging of a checkpointer.

The project intake names LangGraph as the intended framework, and the founder's familiarity is a real
input rather than a rounding error for a solo build.

## Decision

LangGraph compiles and executes the graph, persists checkpoints and provides the interrupt primitive
for human gates. Its authority stops there.

Every conditional edge MUST call a **pure** function in `made/orchestrator/routing.py`: no IO, no
`datetime.now()`, no randomness, no model call. All side effects live in effect handlers invoked by
nodes, never inside a routing predicate. Guards are pure functions over data read before the routing
call.

Purity is enforced by review and by a static check
([07-deferred.md](../07-deferred.md)). A router that
reads the clock is the specific defect to watch for: TTL expiry arrives as an event, and a router that
calls `now()` decides differently on replay than it did in production, silently breaking
[NFR-016](../03-requirements.md).

## Alternatives considered

### A hand-written state machine with no framework — rejected

The strongest case, and the one an earlier draft of this architecture chose. The transition function
is a few hundred lines. There is no dependency to track, no checkpoint schema to migrate across
releases, no framework abstraction between the code and the behaviour, and no upgrade that changes
execution semantics underneath us. Debugging is domain-shaped rather than framework-shaped. Every
property this system needs — deterministic routing, replay, guards — is easier to guarantee when
nothing else touches the loop.

It lost on three counts, none of them about the state machine itself. Durable checkpointing and
crash-resumption are the parts we would actually be writing, and they are unglamorous, easy to get
subtly wrong, and directly load-bearing for
[NFR-019](../03-requirements.md). The human-interrupt mechanism is likewise
a real piece of engineering that the framework has already done. And the intake names LangGraph, so
choosing otherwise spends the founder's learning budget on a component that is not the differentiator.
The decisive observation is that the property we actually need is *deterministic routing*, and that is
obtainable inside the framework by keeping the predicates pure — so we do not have to choose between
the framework's benefits and the guarantee.

### Temporal — rejected

The strongest case in the set. Temporal provides exactly what UF-2 and UF-5 want as first-class
primitives: deterministic replay, per-activity retries and timeouts, durable timers, signals for human
approval, and an audit trail as a by-product. Its determinism constraints would push the codebase in
the direction this ADR is pushing it anyway. At scale it is the correct answer.

It lost on operational cost against the one-operator principle. A self-hosted Temporal cluster is a
second system to run, monitor and upgrade — and it would breach the four-process ceiling
([NFR-021](../03-requirements.md)) immediately. Temporal Cloud is a hosted
dependency an air-gapped customer cannot use, which conflicts with the product's positioning. Because
routing is already pure and effects already sit behind handlers, adopting it later is mechanical
rather than a rewrite, which makes deferral cheap.

### Conversation-driven frameworks (AutoGen, CrewAI) — rejected

The case: far faster to a demo, and genuinely better at ambiguous situations a fixed graph cannot
express. Rejected because termination becomes emergent — the system stops when agents agree they are
finished — which is the precise property UF-2 forbids, and because there is no natural attachment
point for a budget or an attempt cap. A conversation also cannot be folded into a deterministic state,
forfeiting UF-5.

## Consequences

### Positive

Durable checkpointing and interrupts arrive without us writing them. Routing is exhaustively
unit-testable with no database and no model. A historical event log can be replayed through current
routing code to prove a fix ([02-architecture.md](../02-architecture.md)).

### Negative

A dependency now sits in the execution path, with its own upgrade risk and its own checkpoint schema
that must be migrated when it changes; a breaking framework change is a project risk we do not
control. Debugging execution problems means understanding the framework's super-step model as well as
our own state machine, which doubles the surface a new agent must learn. Some framework capabilities —
dynamic `Send` fan-out in particular — are available and forbidden
([02-architecture.md](../02-architecture.md)), which
requires ongoing discipline rather than being structurally impossible. And the purity rule is a
convention that must be actively policed; nothing in the framework prevents someone from putting a
database read in a conditional edge, and that mistake would be invisible until a replay test failed.

## Revisit when

Any of: a LangGraph release breaks checkpoint compatibility in a way that costs more to migrate than
to replace; concurrent Runs across multiple workers require distributed coordination the lease
mechanism cannot provide; or a customer requires guaranteed execution semantics that a single-process
executor cannot offer. In all three cases the migration target is Temporal, and the pure routing
functions transfer unchanged.
