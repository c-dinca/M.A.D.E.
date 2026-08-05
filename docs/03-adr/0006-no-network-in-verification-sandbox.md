# ADR-0006 — Verification runs with no network; dependencies are baked into a pinned image

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-1, UF-4, [04-execution-isolation.md](../02-architecture/04-execution-isolation.md)

## Context

Agents need dependencies present to run tests. The obvious approach is to let the Sandbox install them
at run time, which is what a developer does and what most agent systems do.

That approach brings in the largest attack surface in the whole design at exactly the wrong moment.
Package installation executes arbitrary vendor code with network access, inside the same environment
holding the customer's source. It is the mechanism behind the most common real-world supply-chain
compromises, and it hands an injected instruction a live egress channel
([UF-4](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)).

It is also, separately, the dominant term in Sandbox wall-clock time and therefore in Sandbox cost
([00-context/04-business-model.md](../00-context/04-business-model.md)).

## Decision

Verification Sandboxes run with networking disabled entirely — no interface except loopback
([FR-057](../01-product/03-functional-requirements.md),
[NFR-006](../01-product/04-non-functional-requirements.md)).

Dependencies are installed at **image build time**, performed by the operator outside any Run, against
the Project's declared allowlist, and recorded ([FR-061](../01-product/03-functional-requirements.md)).
The image is pinned by digest on the Project ([FR-008](../01-product/03-functional-requirements.md))
and the digest is recorded on every Run ([FR-060](../01-product/03-functional-requirements.md)).

A Task requiring a dependency that is not in the image fails verification and escalates to a human,
who rebuilds the image. There is no run-time installation path, and adding one requires a superseding
ADR.

## Alternatives considered

### Run-time installation through an authenticated egress proxy with a registry allowlist — rejected

The strongest case, and the design an earlier draft of this architecture chose. It preserves the
natural developer workflow: an agent adds a dependency as part of a change, exactly as a human would.
A forward proxy with a hostname allowlist, a pinned DNS resolver and per-Run credentials is a well
understood control, it produces an auditable record of every fetch, and a caching registry recovers
most of the wall-clock cost. It keeps the product able to handle "add library X and use it", which is
a real and common request.

It lost on the ratio of surface to benefit. That design requires a proxy, a resolver, a credential
mechanism and a cache — four components to build, operate and defend, against
[NFR-021](../01-product/04-non-functional-requirements.md) — to permit a workflow whose safe form is
"a human approves a dependency change", which is what a reviewer would insist on anyway. Disabling the
network removes the entire class: there is no allowlist to bypass, no DNS channel to tunnel through,
no metadata endpoint to reach and no proxy to misconfigure. A control that does not exist cannot be
misconfigured, and for the one-operator principle that matters more than elegance.

### A caching registry mirror reachable from the Sandbox — rejected

The case: a single trusted host, allowlisted, serving only vetted packages. Narrower than open egress
and it solves the cost problem.

Rejected because it is still a network path out of the Sandbox and still executes vendor install
scripts inside it. The mirror also becomes infrastructure to run and keep current — a fifth process by
another name — and the same benefit is available by baking packages into the image, where they are
also digest-pinned and auditable.

## Consequences

### Positive

The verification environment has no egress channel at all, which is the strongest and simplest form of
the UF-4 control and is trivially testable. Runs are reproducible: the same image digest gives the same
dependency set, so a failure is attributable to the change rather than to a package that moved. The
largest component of Sandbox wall-clock disappears. The audit answer to "what was installed" is one
immutable digest rather than a reconstructed network trace.

### Negative

**An agent cannot add a dependency.** Any change requiring a new package fails and needs operator
intervention, which is a genuine capability limitation and will be the most common reason a Run
escalates for a non-obvious reason. Image maintenance becomes an operator task per Project, and a
stale image causes confusing failures that look like agent incompetence. Multi-language repositories
need larger images or several, and image size grows with every toolchain. Onboarding a new Project has
a build step before the first Run, which lengthens time-to-first-value — the thing a design partner
measures first.

## Revisit when

Design-partner usage shows that dependency-adding changes are a substantial share of requests, *and*
Seam 1 has moved isolation to hardware boundaries so that a run-time installation surface is bounded
by a VM rather than a user-space kernel. At that point the proxy design above is the candidate, and it
should be reconsidered as written rather than reinvented.
