# ADR-0015 — Sandboxes hold no credentials; git operations happen control-plane side

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-4, FR-056, NFR-005, [04-execution-isolation.md](../02-architecture/04-execution-isolation.md)

## Context

A Run needs a repository checked out and, at the end, a branch pushed. The conventional approach gives
the execution environment a credential and lets it run `git clone` and `git push`, which is what a
developer's machine and most CI runners do.

That approach puts a credential inside the one environment that is defined as attacker-controlled
([04-execution-isolation.md](../02-architecture/04-execution-isolation.md)). Credential theft is the
first thing a security reviewer asks about
([UF-4](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)), and "the sandbox is
strong enough to protect it" is a much weaker answer than "there is nothing to steal".

## Decision

No credential of any kind exists inside a Sandbox
([FR-056](../01-product/03-functional-requirements.md),
[NFR-005](../01-product/04-non-functional-requirements.md)). Concretely:

**Checkout is a file transfer.** The control plane maintains a bare mirror per Project and populates
the Sandbox workspace through `write_files`. The Sandbox never runs `git fetch`, and it needs no
network to be populated ([ADR-0006](0006-no-network-in-verification-sandbox.md)).

**Delivery is a control-plane action.** The patch is extracted by reading the workspace host-side; the
control plane validates it, commits it to the mirror, and — after a recorded human approval
([ADR-0011](0011-durable-human-approval-gates.md)) — pushes the branch and opens the pull request
using a credential the Sandbox never saw.

**Push scope is minimal.** The credential must have read on the repository, write on non-default
branches, and pull-request creation. Not force-push, not branch deletion, not settings, not
organisation scope. Where the git host supports finer grants, use them; where it does not, say so to
the customer rather than implying an enforcement that does not exist.

**Model credentials likewise never enter a Sandbox**, which is what prevents injected content from
spending budget or reaching a model
([01-system-overview.md](../02-architecture/01-system-overview.md#container-view)).

## Alternatives considered

### Short-lived, narrowly scoped tokens injected into the Sandbox — rejected

The strong case, and it is the industry-standard answer. A token scoped to a single branch reference,
valid for sixty seconds, is close to worthless if stolen. It preserves the natural workflow: the
Sandbox runs real git commands, so `git diff`, `git log` and `git stash` work normally, patch
extraction is trivial, and the agent operates in an environment identical to a developer's — which
makes agent behaviour more predictable and reduces the toolbelt's surface area.

It lost on the difference between "hard to abuse" and "impossible to abuse". A minute is long enough
for an automated exfiltration, and a scoped token still authorises a write to the customer's
repository from inside an environment we have defined as hostile. It also requires network from the
Sandbox, which conflicts directly with [ADR-0006](0006-no-network-in-verification-sandbox.md) — the
two decisions are coupled, and taking this option would reopen the whole egress question. The claim
"nothing to steal" is one sentence in a security review; "sixty-second ref-scoped tokens with an
audit trail" is a conversation.

### An SSH agent or credential helper proxied from the host — rejected

The case: the Sandbox gets no key material, only a channel to an agent that signs on its behalf, so
theft yields nothing persistent. It keeps the natural git workflow with much of the security benefit.

Rejected because it is still a channel out of the Sandbox to a privileged host component, and any
process inside the Sandbox can use it for the duration. It also reintroduces network and a new
protocol surface between zones for a workflow convenience, and the six-operation provider interface
exists specifically to avoid adding channels.

## Consequences

### Positive

The answer to "what happens if an agent is compromised" is that it produces a bad patch a human
declines. Credential theft is not in the threat model because there is no credential, which makes
[NFR-005](../01-product/04-non-functional-requirements.md) a scan with an unambiguous pass condition.
It composes with the no-network decision: neither would be as strong alone. Delivery remains gated on
human approval by construction, since the Sandbox physically cannot push.

### Negative

Git operations inside the Sandbox do not work, so anything an agent might naturally do with git —
inspect history, blame a line, stash — is unavailable unless the toolbelt provides it explicitly, and
each such tool is new surface. Patch extraction is ours to implement by reading and diffing the
workspace, rather than free from `git diff`. Populating a workspace by file transfer is slower than a
local clone for a large repository and counts against
[NFR-001](../01-product/04-non-functional-requirements.md). And the control plane now holds every
credential in one place, which makes it a higher-value target — mitigated by holding secrets in memory
rather than on disk, but it is a real concentration of risk.

## Revisit when

An agent capability that genuinely requires repository history inside the Sandbox is shown to improve
measured pass rate. The response is to add a narrow, read-only history tool to the toolbelt — not to
put a credential in the Sandbox.
