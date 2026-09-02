# The chat front door

The person who notices that something is broken is frequently not the person with commit access. A
support engineer, a product manager, a designer, an account manager — they see the defect, they say so
in a channel, and the request dies there. The chat front door exists to reach that person, because they
are only reachable where they already are.

It is specified in [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md), and that record
reverses three refusals in [14-integrations.md](../02-architecture/14-integrations.md) at once — an
external system may now trigger work, the control plane now has an outbound path to a
customer-configured destination, and there is an inbound ingress surface. The reasons for those
refusals have not become wrong. They have been overruled by a product requirement, and the mitigations
below are mitigations rather than answers.

## What it is, honestly

**In v1 it brokers a request onto a declared work class the requester is entitled to, or declines it
with a reason** ([FR-108](03-functional-requirements.md)). It does not turn arbitrary prose into
arbitrary change.

This distinction has to be stated first and repeated, because the two versions look identical in a
demo and diverge on first contact with a real requester.

| Serves | Does not serve |
| --- | --- |
| "Bump lodash in the checkout service" | "The export button is broken for German customers" |
| "Run the lint sweep on the payments module" | "Make the search faster" |
| "Upgrade this repo to the new SDK" | "Add a CSV download to the report page" |

The left column maps onto a declared class with extractable parameters. The right column requires
generated planning — a specification, a task graph, and a verification command produced per Task —
which [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) deferred and which
depends on the unresolved OQ-07.

The honest description of the v1 front door is **"ask for a declared kind of maintenance, in plain
language"**. Any customer-facing material describing it as "describe any change" is inaccurate until
**OQ-19** is answered.

## From a message to a Run, or to a decline

A chat message becomes a **request**, and a request is not a Run
([FR-106](03-functional-requirements.md)). Requests are their own entity with their own lifecycle and
their own event log. Nothing executes and no budget is spent beyond the bounded triage allowance below.

```
RECEIVED ──► TRIAGED ──┬──► SPECIFIED ──► RUN_CREATED ──► (the Run's own lifecycle)
                       ├──► CLARIFYING ──► TRIAGED
                       └──► DECLINED
                                 ▲
        WITHDRAWN ◄── (requester or admin, from any non-terminal state)
```

**`RECEIVED`** — the message arrived, the requester's identity was resolved, and an ingress event was
recorded before anything acted on it ([FR-116](03-functional-requirements.md)). An **unmapped chat
identity cannot create a request**: the message is answered with a decline naming the missing mapping
([FR-107](03-functional-requirements.md)).

**`TRIAGED`** — the message is matched against the work classes this requester is entitled to, and the
parameters each candidate class needs are extracted. Triage is a model call and passes through budget
admission like every other ([FR-110](03-functional-requirements.md)).

**`CLARIFYING`** — a required parameter or the target repository is missing. The broker asks in the
originating thread, and the allowance is **declared and small** (default 2 questions). A request
unanswered for its TTL is declined with a reason ([FR-109](03-functional-requirements.md)). There is no
open-ended conversation: an unbounded dialogue is unbounded spend and unbounded latency, and this
system has neither.

**`SPECIFIED`** — a class and its parameters are determined, the entitlement and the budget allow it.

**`RUN_CREATED`** — a Run is created from that class, subject to every existing bound. From here it is
an ordinary Run.

**`DECLINED`** — with a reason, in the thread, recorded as an event. Reasons are a closed set, because
they are the instrument that says which class to build next: `no_matching_class`,
`not_entitled_repository`, `not_entitled_class`, `ambiguous_after_clarification`,
`clarification_timeout`, `budget_exhausted`, `repository_access_unavailable`, `requires_generated_plan`.

That last reason is the important one. **`requires_generated_plan` is how the front door tells the
truth about its own limits**, and its frequency is the measurement that answers OQ-19.

### Ambiguity is declined, never guessed

If triage cannot determine the target repository, the class, or a required parameter after its
clarification allowance, the request is declined ([FR-111](03-functional-requirements.md)). This is
[FR-029](03-functional-requirements.md)'s rule — escalate rather than guess — applied at the front
door, and it is the single most important behaviour here. A non-developer cannot tell whether the
system understood them; a wrong guess acted on autonomously produces a pull request that looks
plausible and answers a question nobody asked.

## Who may trigger what

Every requester is an identity **mapped by an administrator** to an entitlement
([FR-107](03-functional-requirements.md)): a tenant, a team, the repositories they may target, the work
classes and lanes they may invoke, and a per-request and per-period budget.

**Chat platform membership is never itself an entitlement.** Who is in a channel is not a decision the
customer's security function has made: channels are edited by people who have no idea they control
anything, guests get added, and channel-based authority is invisible to the reviewer who has to approve
this installation. The mapping is administered in the console
([09-web-interface-and-admin-console.md](09-web-interface-and-admin-console.md)) and every change to it
is an event.

The consequence to be clear-eyed about: **we now hold a mapping from human identities to spend
authority.** That is a small identity system with real consequences, an administrative surface to
build, and a thing to get wrong.

## Approval does not move to chat

A recorded approval requires an attributable principal and the artifact digests that principal saw
([ADR-0011](../03-adr/0011-durable-human-approval-gates.md)). A chat button is neither by default: it is
easy to click, weakly bound to an identity relative to an API key, and hard to bind to what was
displayed.

So the broker **posts a link**; the decision is taken in the console or through the API
([FR-112](03-functional-requirements.md)). Whether a chat-native approval with an adequate binding is
acceptable is **OQ-20**, and it is recorded as open rather than closed because a signed, digest-bound
chat interaction is conceivable — it is simply not designed.

A second rule that follows from the same instinct: **self-approval of one's own chat request is
forbidden by default** ([FR-135](03-functional-requirements.md)). A requester who can ask for a change
and then approve its delivery has removed the gate that makes the whole system approvable.

## Following progress without a git-host account

The requester is the one person in this product who has no repository access and should not gain any by
asking for a change. They get two surfaces ([FR-113](03-functional-requirements.md)):

**The originating thread.** The broker posts state transitions and the terminal outcome back into the
thread the request came from, so the conversation and its answer stay together.

**A scoped read-only view.** A console view of their own request and its Run's status, reachable
without a git-host account, showing nothing outside their entitlement.

## What may be posted to a chat platform

A chat platform is a third party under
[13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)'s classification.
Posting to one is an **egress decision**, recorded as one, subject to the allowlist, and disableable per
deployment.

What may be posted is itself an allowlist, not a discretion ([FR-114](03-functional-requirements.md)):

| Permitted | Forbidden by default |
| --- | --- |
| Request state and its transitions | Source code, in any quantity |
| The work class invoked and its parameters | Patch or diff content |
| The terminal outcome and, if declined, the reason | Verification output, including failure messages |
| Cost against the requester's allowance | Repository paths and file names |
| The pull-request URL | Finding bodies — counts only |
| Finding **counts** by evidence state | Anything from an audit export |

The rule behind the table: a chat channel is a place where an organisation's own access controls are
loose and its retention is long. Source code posted there has left the perimeter in the least
recoverable way available, and it would be discovered by the first security review.

## Security consequences

A chat participant is a **new adversary**, recorded as A6 in
[13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md). They differ from
repository content — the existing A2 — in a way that matters: they are **interactive**, so they can
iterate against the triage, learn what it accepts, and try again. Repository content gets one shot.

What stands between a channel guest and a spend is the entitlement check and nothing else. So:

- an unmapped identity cannot create a request at all;
- a mapped identity cannot exceed its per-request or per-period budget;
- a mapped identity cannot target a repository or invoke a class outside its entitlement;
- triage output is a **class selection and parameters**, not a plan and not a command — so the worst
  outcome of a successful prompt injection through chat is a Run of a class the requester was already
  entitled to invoke, with parameters they could have supplied directly;
- every request, every clarification, every decline and every posted message is an event.

That last bullet is the design's real answer. The blast radius of the chat surface is bounded by the
entitlement, not by the triage model's judgement, which is the same architecture used for repository
content ([06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md),
injection as an authorisation problem).

## What is deliberately not built

**No free-text Run.** A request that matches no class is declined
([FR-108](03-functional-requirements.md)). It is not converted into a Run with the message as intent,
which is the shortcut that would silently reinstate the deferred milestone.

**No unbounded conversation.** The clarification allowance is declared, small and enforced. This is not
a chat product and the previous non-goal's second half survives
([00-context/01-problem-and-vision.md](../00-context/01-problem-and-vision.md#non-goals)).

**No approvals, merges or configuration changes from chat.** The front door is intake and status.
Administration happens in the console.

**No proactive posting.** The system posts into a thread it was asked in. It does not announce Runs,
open pull requests or findings into channels nobody requested them in — an agent that can start
conversations is an agent that can generate notification volume nobody can turn off.

**No more than one platform first.** Three platforms means three APIs, three permission models and
three sets of breaking changes maintained by one person. Which one is **OQ-22**.

> **Open question OQ-12** — Which advisory capability ships **first**: pull-request review, TODO
> triage, or the chat front door. They have very different risk profiles. **Pull-request review**
> exercises the evidence requirement hardest and is the one that proves the advisory lane is not a
> comment generator, but its acceptance rate is unmeasurable for weeks. **TODO triage** is the cheapest
> and the easiest to evaluate, and nobody buys it. **The chat front door** reaches a new user and is
> the only one that needs an inbound surface, an outbound egress path, an entitlement system and a new
> adversary — so it is by far the largest, and its value depends on OQ-19. **Blocks:** the ordering of
> the advisory milestones and which of the three integration surfaces gets built first.
> **Resolved by:** the founder naming one.

> **Open question OQ-19** — Whether **generated planning returns to the critical path** so that the
> chat front door can serve requests that no work class covers. This is the contradiction the vision
> change created and it is the largest open question in the specification.
> [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) deferred the Architect and
> stated that a Run reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`; a free-text request
> from a non-developer is precisely the input the Architect was specified for. **Blocks:** whether
> US-004, US-005, US-006 and US-008 come back; whether OQ-07 (generated verification commands) returns
> to the critical path; the Architect's backlog items; and what the front door can honestly be
> described as. **Resolved by:** the founder deciding — ideally informed by the recorded frequency of
> `requires_generated_plan` declines, which is why that reason exists and is measured before the
> question is answered.

> **Open question OQ-20** — Whether an **approval may be given from a chat platform**. The constraint
> is not negotiable: an approval must be attributable to a principal and bound to the artifact digests
> that principal saw. Whether a chat interaction can satisfy that is a design question nobody has
> answered. **Blocks:** nothing — v1 posts a link. **Resolved by:** the founder saying whether the
> convenience is worth designing for, and a design that meets the binding requirement.

> **Open question OQ-22** — Which chat platform is supported **first**: Slack, Microsoft Teams or
> Discord. The founder named all three. They differ in permission model, in whether inbound
> connectivity is required, and in how much of an organisation's access control is expressed in
> channel membership. **Blocks:** the chat adapter backlog item and the integration suite's fixtures.
> **Resolved by:** the founder naming the platform the first design partner actually uses.
