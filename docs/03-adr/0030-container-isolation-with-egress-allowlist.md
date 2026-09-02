# ADR-0030 — Container isolation with a deny-by-default egress allowlist; microVM deferred

**Status:** Accepted
**Date:** 2026-09-02
**Supersedes:** [ADR-0006](0006-no-network-in-verification-sandbox.md)
**Relates to:** OQ-09 (closed by this ADR), OQ-10 (closed by this ADR), [ADR-0005](0005-gvisor-v1-firecracker-deferred.md), [ADR-0015](0015-credential-brokering-no-secrets-in-sandbox.md), FR-055, FR-056, FR-057

## Context

Two questions were open and they turn out to be one question.

**OQ-10** asked whether the isolation boundary survives as specified. [ADR-0005](0005-gvisor-v1-firecracker-deferred.md)
chose a user-space kernel because it assumed hostile input and untrusted code, and its own revisit
trigger fired when the deployment became hosted: under a **shared** runtime an escape would be a
cross-customer breach.

**OQ-09** asked how a dependency upgrade obtains its new package version, given that
[ADR-0006](0006-no-network-in-verification-sandbox.md) gave the execution environment no network at
all. It was recorded as the most important unresolved question in the specification, because it
blocked the first sellable capability.

[ADR-0029](0029-hosted-first-one-instance-per-client.md) changes the premise behind both. With one
isolated instance per client there is no cross-customer surface inside a runtime: the threat that made
the boundary question urgent is answered by separation. What remains inside an instance is one
client's own code, executed on their behalf — which is the threat model
[ADR-0005](0005-gvisor-v1-firecracker-deferred.md) was originally written against, at its original
severity rather than an escalated one.

## Decision

**The Rehearsal Room — the isolated environment a Scene executes in — is a container**, with:

- **no host paths mounted in.** Files enter and leave through the provider interface, as before
  ([FR-055](../03-requirements.md), [FR-056](../03-requirements.md)).
- **egress denied by default, with a declared allowlist** ([FR-057](../03-requirements.md)). The
  allowlist contains the package registries a recipe needs, and nothing else by default. Every
  decision — allowed or denied — is recorded in the Prompt Book.
- **no credentials of any kind.** [ADR-0015](0015-credential-brokering-no-secrets-in-sandbox.md) is
  unchanged and reinforced: git writes and model calls happen control-plane side, never from inside
  the room.
- **explicit CPU, memory, process and disk limits**, and destruction when the Scene ends or the room
  goes idle ([FR-054](../03-requirements.md)).
- **fail closed.** If the runtime is unavailable or fails its preflight check, the system refuses to
  execute. There is no fallback to a weaker runtime ([FR-055](../03-requirements.md)).

**The model endpoint is not on the Rehearsal Room's allowlist.** It is reachable from the control
plane only. This preserves the property that injected repository content cannot spend budget or reach
a model directly, which is the boundary that makes prompt injection bounded rather than open-ended.

**This closes OQ-09.** A dependency upgrade resolves versions from a package registry on the
allowlist. The question existed only because the environment had no network; it does not need a
per-candidate image rebuild and it does not need a pre-populated cache.

**MicroVM isolation is deferred, not rejected.** It becomes the decision to revisit when a client
requires hardware-level isolation at a security review. Recorded in
[07-deferred.md](../07-deferred.md) with that trigger.

## Alternatives considered

### Keep the user-space kernel and keep verification fully offline — rejected

The strongest case, and it is the position the repository held. A workload that issues no syscalls to
the host kernel has a materially smaller attack surface, and an environment with **no** network has no
allowlist to bypass, no DNS exfiltration channel and no metadata endpoint to reach —
[ADR-0006](0006-no-network-in-verification-sandbox.md) called it "a stronger and *simpler* control
than a proxy with an allowlist", which is true. It also removes remote package installation, the
largest supply-chain surface in agentic coding, from the runtime entirely.

It loses on two grounds that compound. The offline half made the first work class impossible: OQ-09
had no affordable answer, and a per-candidate image rebuild before every upgrade attempt is a cost the
Sandbox latency budget cannot carry. And the user-space kernel's justification was proportionate to a
cross-customer threat that instance separation removes — paying for a stronger boundary against a
threat that no longer exists is how a security posture becomes decoration. What is given up is real
and is recorded below: a container escape is a host compromise, and that host now belongs to one
client rather than to all of them.

### Container with no egress at all — rejected

The case: it keeps ADR-0006's simplicity while accepting the weaker kernel boundary, so it is a
strictly smaller change.

Rejected for the same reason as the previous option: it leaves OQ-09 open, and OQ-09 blocks the only
capability v1 has.

### Container with unrestricted egress — rejected

The case: dependency resolution, tooling and test suites all reach the network in normal
development, so an allowlist will produce failures that look like our bug rather than the customer's
configuration.

Rejected because unrestricted egress makes source exfiltration a one-line payload in any file the
agent reads, and the recorded egress decision — the thing a security reviewer actually asks for —
becomes meaningless when everything is allowed. The predicted friction is accepted and its handling is
specified: a denied destination is a recorded event with the destination named, so the operator
extends the allowlist deliberately rather than debugging a silence.

### MicroVM now — rejected for v1

The case: it is the boundary the specification always intended, it removes the shared-kernel
concession entirely, and doing it now avoids migrating later.

Rejected on cost against what it buys inside one client's own instance. It needs microVM lifecycle
management, snapshotting, TAP networking and a rootfs pipeline — a body of work that does not move the
first three milestones — and the threat it addresses beyond a container is a kernel escape into a host
holding that same client's code. The provider interface keeps the swap additive
([15-future-phase-seams.md](../02-architecture.md) — Seam 1 survives the cut), and the trigger is a
client requirement rather than our judgement.

## Consequences

### Positive

The first work class becomes buildable: OQ-09 is closed without a per-Run image build, and a
dependency upgrade resolves versions the way every other tool does. Isolation gets simpler to operate
and to explain — a container, no mounts, an allowlist, no credentials — which matters when one person
runs it. The recorded egress decision remains meaningful because the default is deny. And the
boundary now matches the threat it defends against rather than a larger one that separation already
handled.

### Negative — mandatory

**A container escape is a host compromise.** The kernel is shared with the host, so a kernel
privilege-escalation vulnerability reaches the control plane on that instance. Separation bounds the
blast radius to one client; it does not stop the escape. This is a genuine weakening relative to the
previous decision and it is the price of closing OQ-09 affordably.

**Egress exists where it did not.** A recipe's allowlist is a channel: a poisoned package's install
script can reach a registry-shaped destination, and DNS resolution to an allowed host carries bits.
[ADR-0006](0006-no-network-in-verification-sandbox.md)'s claim that "there is no allowlist to bypass"
was correct, and we no longer have it.

**The allowlist will be wrong at first**, and every wrongness looks like a broken product. A test
suite that fetches a fixture, a linter that checks a schema URL, a package that resolves a peer
dependency from an unexpected host — each is a denied egress event and an operator decision.

**The escape suite's network cases have to be rewritten rather than deleted.** "No interface but
loopback" was a simple assertion. "Only these destinations, and every attempt recorded" is a harder
one, and it is the assertion the product's egress claim now rests on
([NFR-007](../03-requirements.md)).

**Two accepted ADRs are affected and neither becomes wrong.** ADR-0006 is superseded on its network
conclusion while its second rationale — that baking dependencies removes the largest component of
execution wall-clock — is lost with it, so per-Scene wall-clock will be worse. ADR-0005's user-space
kernel is stood down for v1 with its provider seam intact.

## Revisit when

Any of: a client requires hardware-level isolation at a security review; an escape-suite finding
cannot be closed within a container boundary; a denied-egress rate high enough that the allowlist is
being widened routinely rather than deliberately — which would mean the deny-by-default control is
nominal; or a poisoned-dependency incident, which would reopen offline resolution rather than the
kernel boundary.
