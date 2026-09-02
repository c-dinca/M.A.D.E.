# ADR-0032 — Three actors in v1, of which only two are roles: Stage Manager, Crew, Prompter

**Status:** Accepted
**Date:** 2026-09-02
**Narrows:** the role set in [ADR-0022](0022-two-lanes-verified-and-advisory.md) and the role model in the previous architecture
**Relates to:** OQ-16 (closed by this ADR), [ADR-0014](0014-verification-oracle-is-authoritative.md), [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md), [ADR-0023](0023-advisory-findings-carry-evidence.md), [02-architecture.md](../02-architecture.md)

## Context

The role model specified six roles — Architect, Developer, QA, DevOps, Reviewer, Triager — and a
procedure for adding more, and it left the list itself as OQ-16. It also argued, at some length, that
the orchestrator is **not** a role: it executes the declared verification command with no model in the
loop, and calling it a role would imply a prompt and a model where the absence of both is
load-bearing.

The founder has answered OQ-16, and the answer is smaller than the model that asked the question.

## Decision

Three actors. **Two of them are roles.**

| Actor | Is it a role? | What it does | What it may never do |
| --- | --- | --- | --- |
| **Stage Manager** | **No — it is code** | Runs the loop: instantiates a Scene from a declared recipe, applies patches, executes the declared command, records every event, decides every transition | Hold a prompt or call a model. Its lack of judgement is the property that makes the exit code mean something |
| **Crew** | Yes | Makes the change. Model, prompt, and writes **only** inside the Scene's declared paths ([FR-080](../03-requirements.md)) | Modify the declared command, decide whether it succeeded, or write outside its declared paths |
| **Prompter** | Yes | Reviews a human's Preview and comments **only through evidence**: the test that fails and demonstrates the problem, or a comment marked unverified ([FR-088](../03-requirements.md)) | Write to the reviewed code, ever. Its writes are confined to its own evidence room ([FR-080](../03-requirements.md)) |

**Director, Scenarist and Répétiteur do not exist in v1.** A dependency upgrade does not need an
architecture agent: the plan is a declared recipe, not a generated one
([ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md),
[FR-081](../03-requirements.md)). Recorded in [07-deferred.md](../07-deferred.md).

**Adding a role requires an ADR.** Not a prompt file, not a configuration entry. The check that keeps
the set small is unchanged and is the one most likely to be skipped: a candidate that shares its lane,
its states, its tool authority, its model tier and its output kind with an existing actor is **a
prompt variant, not a role.**

## Alternatives considered

### Keep the six-role model — rejected

The case is capability and it is the one the word "swarm" implies: specialised agents produce better
output than general ones, an Architect can decompose work no recipe covers, a QA agent can write the
tests a repository is missing, and a Triager turns a chat message into work. Each is a real capability
and each was fully specified.

Rejected because five of the six have nothing to do in v1. The Architect has no work when the plan is
a declared recipe; the Triager has no work when the chat front door is deferred; QA has no work when
test generation is a separate lane for later; DevOps has no work when the recipe touches manifests and
call sites. A role with nothing to do still costs a prompt to maintain, a tier to tune, golden cases
to keep passing, an adversarial case, and a permanent obligation to explain how it differs from its
neighbour. Six roles that cover one capability is worse than two that cover it.

### Two roles, folding the Prompter into the Crew — rejected

The case: one model with one prompt, given a different instruction depending on whether it is changing
code or reviewing it. Fewer moving parts, and the previous role model's own test — same lane, same
tools, same tier — would nearly classify them as prompt variants of each other.

Rejected because they fail that test on the property that matters: **tool authority**. The Crew writes
into the repository's declared paths; the Prompter must never write to reviewed code at all. That is a
different authority grant, enforced by the state that hands out the toolbelt rather than by an
instruction in a prompt — and an actor that can write where the other cannot is a role, not a variant.
They are also in different lanes, with different definitions of success.

### One generalist agent — rejected

The case: the strongest models handle both tasks, and the orchestration layer is a cost that a better
model reduces to nothing.

Rejected because the lane boundary would then exist only inside a prompt. The whole guarantee is that
a verified change and a judgement comment cannot be confused, and an actor that produces both, with
one authority grant, makes that a matter of the model's discipline rather than the system's.

## Consequences

### Positive

The v1 build has two prompts to write, two tiers to tune and two adversarial cases to hold — not six.
The distinction that carries the product's guarantee is expressed as **authority** rather than as
personality: the Crew can write code and the Prompter cannot, decided by the state that grants the
tools. And the argument that the orchestrator is code rather than a role is now settled rather than
recurring, which removes the most common category error in reading this architecture.

### Negative — mandatory

**"A swarm of specialised agents" is now two agents.** That is a materially smaller story than the
vision it came from, and it will read as a retreat to anyone who saw the earlier version. The honest
description is two actors and a loop.

**Anything no recipe covers is refused.** With no Architect there is no path from an unanticipated
request to work, so the answer is a decline. That is correct and it is also the limitation that
**OQ-19** keeps visible.

**The role-addition bar is now the thing under pressure.** Every future capability will arrive as "we
just need one more agent", and the specification's only defence is an ADR requirement and the
prompt-variant test. Both are easy to route around by someone in a hurry.

**Four fully specified roles are now unbuilt work carried in history.** Their specifications survive
in the ADRs and in Deferred, and specification that is never built is a cost that was already paid.

## Revisit when

A work class is admitted whose plan cannot be a declared recipe — which is **OQ-19** resolving toward
generated planning, and would reinstate the Architect specifically — or a lane is admitted whose output
is neither a change to declared paths nor a comment with evidence, which is a new authority grant and
therefore a new role by this ADR's own test.
