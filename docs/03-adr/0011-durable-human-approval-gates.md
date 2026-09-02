# ADR-0011 — Human approval is a durable state, and delivery approval is mandatory

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** FR-032, [02-architecture.md](../02-architecture.md)

## Context

The buyer's security function holds a veto over installation
([01-product.md](../01-product.md)). What
converts that veto into an approval is not the quality of the output; it is the guarantee that nothing
reaches their repository without a person deciding.

There is also an internal reason. Planning is cheap and implementation is not
([02-architecture.md](../02-architecture.md)), so a gate between them is the highest-
leverage point at which a human can prevent wasted spend on a misunderstood request.

The engineering question is how a waiting Run is represented. A Run may wait for hours, and holding a
process, a Sandbox or an open connection for that time is both a cost and an exposure.

## Decision

`AWAIT_HUMAN` is a durable State with a `reason` and a `resume_to`. Entering it destroys the Sandbox
and holds no process; resuming recreates the Sandbox from the pinned image and the recorded head
commit.

Two gates in v1. **Delivery approval is mandatory and not configurable**: no branch is pushed and no
pull request opened without a recorded approval
([FR-032](../03-requirements.md)). **Plan approval is per Project**, default on
for a new Project.

An approval records the actor, the decision, the reason, the State it unblocked, and **the artifact
digests the actor was shown**. Approving something the human never saw is not an approval, and
recording what was displayed is what makes that checkable afterwards.

Approval requests carry a TTL; an unanswered gate terminates in `ABORTED` rather than waiting
indefinitely.

## Alternatives considered

### Fully autonomous delivery, with approval as a Project setting — rejected

The strong case: for a mature customer with good CI, a pull request is already a review gate, so
requiring approval before *opening* one is a redundant step that slows the loop and undercuts the
product's value proposition. Autonomy is what the customer is buying, and an always-on gate makes the
system a suggestion engine. Sophisticated buyers will ask for it.

Rejected because the gate is the thing that gets the system installed. A configurable gate becomes a
gate that is off in the deployment where an incident happens, and the incident is then ours. The gate
also costs little: it is a single decision on work that is already complete and already verified,
compared against the alternative of defending an autonomous write path in every security review.

### Chat-based approvals — rejected

The case: approvals happen where people already are, so latency drops from hours to minutes, which
directly improves throughput.

Rejected because an approval must be attributable to an actor and bound to the artifact digests they
saw. A chat button is weakly attributable relative to an API key and hard to bind to displayed
content. Noted as a deliberate non-integration in
[02-architecture.md](../02-architecture.md).

### Blocking the process while waiting — rejected

The case: much simpler to implement — the node simply waits, and no state needs to be persisted or
resumed.

Rejected because a Run waiting overnight would hold a worker slot and a Sandbox, capping concurrency at
the number of unapproved Runs and leaving an idle Sandbox holding customer source for hours. The
framework's interrupt primitive exists precisely to avoid this, and it is one of the reasons a
framework was adopted at all ([ADR-0002](0002-langgraph-as-executor-with-pure-routing.md)).

## Consequences

### Positive

Waiting is free: no process, no Sandbox, no exposure window. The security question "can it write to my
repository unattended" has a structural answer rather than a policy answer. The plan gate stops
expensive misunderstandings before implementation spend. Approvals are attributable in the audit log
with what was shown.

### Negative

Wall-clock time to delivery is dominated by human availability, so the system cannot claim end-to-end
autonomy and a demo looks slower than a competitor's. Resuming costs a Sandbox recreation, adding
latency at every gate ([NFR-001](../03-requirements.md) applies twice per
Run rather than once). The approval TTL will occasionally abort work someone intended to approve,
which is annoying and correct. And a Run parked for approval is easy to forget, so the viewer must
make parked Runs prominent — an interface obligation created by this decision.

## Revisit when

A design partner with mature CI explicitly requests autonomous delivery to a non-default branch **and**
the golden-suite pass rate plus the escape suite give grounds to trust it. Even then the change would
be a Project-level opt-in with a superseding ADR, and the default would remain mandatory approval.
