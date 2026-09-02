# ADR-0025 — A chat request is brokered into an entitled work class or declined; it never becomes a Run directly

**Status:** **Suspended by the 2026-09 cut** ([ADR-0033](0033-one-verified-lane-one-judgement-lane.md)).
**Date:** 2026-09-02

> **Suspended: Front of House — the chat entry point — is deferred**
> ([07-deferred.md](../07-deferred.md)). Nothing here is being built in v1.
>
> **But its central argument is live, and it is what OQ-19 turns on.** This record identified that
> "chat as a front door to declared work" and "chat as a front door to arbitrary change" are two
> different products behind one sentence, that they look identical in a demo, and that they diverge
> the first time somebody asks for something no recipe fits. The founder has accepted the narrow
> version and made it a selling rule: **never demonstrate the chat entry point without saying in the
> same sentence that the list of maintenance types is closed.** That rule comes from this record.
>
> The `requires_generated_plan` decline reason and its indexing also survive the suspension in
> intent: when Front of House is built, that reason is the instrument that measures how often the
> narrow door is insufficient, which is what settles OQ-19.
>
> Read this before building any chat integration. Its entitlement model — an administered mapping,
> never channel membership — and its posting allowlist are the parts that stop it becoming an
> exfiltration channel.
**Relates to:** [UF-2](../02-architecture.md), [UF-4](../02-architecture.md), [ADR-0011](0011-durable-human-approval-gates.md), [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md), [07-deferred.md](../07-deferred.md), OQ-19, OQ-20, OQ-22, FR-106 to FR-114

## Context

The founder wants a non-developer to describe a change in Discord, Teams or Slack and get a pull
request. That capability is absent from the specification, and it is absent on purpose:
[14-integrations.md](../02-architecture.md) refuses issue trackers as a Run trigger
because "an external system creating Runs means an external system spending budget", refuses chat
approvals because an approval must be bound to the artifact digests an attributable actor saw, and
Seam 6 forbids any outbound path from the control plane to a customer-configured destination. A chat
front door reverses all three.

It also collides with the deepest scope decision in the repository.
[ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) removed free-text intake from v1 and
deferred generated planning: a Run is created from a work class, and *"a Run reaches `IMPLEMENT` with
zero model calls in `SPEC` or `PLAN`"*. A free-text message from a non-developer is exactly the input
the Architect was specified to handle and exactly the input ADR-0020 said v1 would not accept. The
user stories for free-text submission — US-004, US-005, US-006, US-008 — are currently parked in the
deferred milestone.

So there are two different products behind one sentence, and they must not be conflated:

1. **Chat as a front door to declared work.** A message is matched against the work classes the
   requester is entitled to, its parameters extracted, and a Run created from that class. Everything
   already built applies. What cannot be matched is declined with a reason.
2. **Chat as a front door to arbitrary change.** A message becomes a generated specification and plan.
   This requires the Architect, generated verification commands (OQ-07), and plan approval — the whole
   of the deferred milestone.

Choosing (1) and calling it (2) would be the most damaging thing this document could do, because the
demo looks identical and the failure appears only when a real non-developer asks for something no
template fits.

## Decision

**A chat message becomes a `request`, and a request is not a Run** (FR-106). Requests have their own
entity, their own lifecycle and their own event log. Nothing executes and no budget is spent while a
request is being triaged beyond the bounded triage allowance below.

**Every requester is an identity mapped by an administrator to an entitlement** (FR-107): a tenant, a
team, the repositories they may target, the work classes and lanes they may invoke, and a per-request
and per-period budget. An unmapped chat identity CANNOT create a request — the message is answered with
a decline naming the missing mapping. Chat platform membership is never itself an entitlement, because
who is in a channel is not a decision our customer's security function has made.

**v1 brokers a request onto a declared work class, or declines it** (FR-108). Triage matches the
message against the entitled classes and extracts parameters. If no class fits, the request is
`DECLINED` with the reason stated in-channel and recorded as an event. **It is not converted into a
free-text Run.** Whether generated planning returns to the critical path so that arbitrary requests can
be served is **OQ-19** and is not decided here.

**Clarification is bounded** (FR-109). The broker may ask at most a declared number of clarifying
questions in the originating thread (default 2), and a request unanswered for a declared TTL is
`DECLINED` with a reason. There is no open-ended conversation: an unbounded dialogue is an unbounded
spend and an unbounded latency, and this system does not have either. Triage and clarification pass
through the same budget admission as every other model call (FR-110).

**Ambiguity is declined, never guessed** (FR-111). If triage cannot determine the target repository,
the class, or a required parameter after its clarification allowance, the request is declined. This is
[FR-029](../03-requirements.md)'s rule applied at the front door.

**Approval does not move to chat.** A recorded approval requires an attributable actor and the artifact
digests that actor saw ([ADR-0011](0011-durable-human-approval-gates.md)). v1 posts a link; the
decision is taken in the console or through the API (FR-112). Whether a chat-native approval with an
adequate binding is acceptable is **OQ-20**.

**A requester follows progress in-channel and through a scoped console view** (FR-113). The broker
posts state transitions and the terminal outcome into the originating thread, and the requester may
open a read-only view of their own request without a git-host account. They never gain repository
access by asking for a change.

**What may be posted to a chat platform is an allowlist, not a discretion** (FR-114): request state,
the class invoked, the outcome, cost against the requester's allowance, a pull-request URL, and
finding *counts*. Source code, patch content, verification output, repository paths and finding bodies
MUST NOT be posted by default. Chat is a third party under
[13-security-and-compliance.md](../02-architecture.md)'s classification, so
posting C2 material into it is an egress decision, recorded as one, and disableable per deployment.

## Alternatives considered

### No chat front door; the customer calls the API from their own automation — rejected

This is the position [14-integrations.md](../02-architecture.md) currently holds and its
case is strong. It keeps authorisation entirely on the customer's side: they decide who may trigger
what, using their own identity system, and we never hold a mapping from a chat handle to a spend
authority. It adds no inbound surface, no outbound egress path, and no new adversary. A customer who
wants Slack integration writes forty lines of glue and owns the consequences.

It loses on the specific user the founder is targeting. A non-developer will not call an API, and
"ask your platform team to build a bot" is the answer that means the capability does not exist. The
whole point of the front door is to reach the person who does not have a git-host account, and that
person is only reachable where they already are. What survives from this alternative is its
authorisation instinct: the entitlement mapping is administered by the customer, in the console, per
identity — not inferred from channel membership.

### Chat creates Runs directly, with the channel as the authorisation boundary — rejected

The case: it is by far the simplest thing that works. A channel is already an access-control decision
somebody made, the mapping is one row, and the latency from message to pull request is seconds.

Rejected because a chat channel's membership is not a spend authority and not a repository grant. It is
routinely edited by people with no idea it controls anything, guests get added to channels, and
channel-based authority is invisible to the security reviewer who has to approve this installation.
Creating a Run directly also skips the state in which a request can be declined with a reason, which
is where most of the honest behaviour lives.

### Route chat requests through the Architect immediately, accepting arbitrary requests in v1 — rejected

The honest case for this is that it is what the founder actually described. Option (1) above is a
narrower capability than "open a pull request from a conversation", and shipping the narrow version
risks the front door feeling broken the first time somebody asks for something real.

Rejected as a decision to take *here*, because it reverses ADR-0020's central scope choice and depends
on OQ-07, which is unresolved. Doing it silently would make this ADR the place where the deferred
milestone came back without anyone deciding to build it. It is recorded as OQ-19 with exactly this
framing so that the founder decides it, and this ADR's rules survive either answer: the request
entity, the entitlement mapping, the bounded clarification and the posting allowlist are all needed in
both worlds.

### Chat as the approval surface too — rejected

The case: the requester is already there, a button is one tap, and the round trip through a console
loses most of the convenience the front door was built for.

Rejected because an approval is the security decision this whole product is gated on. It has to be
attributable to a principal and bound to the digests that principal saw, and a chat button is neither
by default. Recorded as OQ-20 rather than closed, because a signed, digest-bound chat interaction is
conceivable — it is simply not designed.

## Consequences

### Positive

The product becomes reachable by the person who has the problem rather than only by the person who has
commit access, which is the largest addressable change in the founder's list. Declining honestly, with
a reason, in the channel, is a better experience than a silent failure and it is a capability
competitors mostly do not have. Requests being a separate entity means the front door can be measured
— how many requests were declined, and for what reason, is the sharpest available signal about which
work class to build next.

### Negative — mandatory

**Three refusals in [14-integrations.md](../02-architecture.md) are reversed at once**:
an external system may now trigger work, the control plane now has an outbound path to a
customer-configured destination, and there is an inbound ingress surface. Each was refused for a stated
reason, and the reasons have not become wrong — they have been overruled by a product requirement. The
egress allowlist, the posting allowlist and the recorded egress decision are mitigations, not answers.

**The narrow version will disappoint.** Matching a message onto a declared work class serves "bump
lodash in the checkout service"; it does not serve "the export button is broken for German
customers". Until OQ-19 is answered, the front door's honest description is "ask for a declared kind of
maintenance in plain language", and any material that describes it as "describe any change" is
inaccurate.

**A new adversary joins the threat model.** A chat participant is an untrusted author of text that
reaches a model, and unlike repository content they are interactive and can iterate against the
triage. [13-security-and-compliance.md](../02-architecture.md) gains
adversary A6, and the entitlement check is the only thing between a channel guest and a spend.

**We now hold a mapping from human identities to spend authority**, which is a small identity system
with real consequences and an administrative surface to build, audit and get wrong.

**Chat platform integrations rot.** Three platforms, three APIs, three permission models, three sets of
breaking changes, maintained by one person. Which platform ships first is OQ-22 precisely because
building all three is not affordable.

**Triage spends money on work that is then declined.** A declined request has a non-zero cost and
produces nothing, which is the failed-Run margin problem in a new place, at a volume set by however
many people are in a channel.

## Revisit when

Either: the recorded decline reasons cluster in one place — a class that does not exist, or a target
that cannot be inferred — in which case the fix is that class or that parameter, not a wider triage;
or OQ-19 is answered in favour of generated planning, at which point this ADR's brokering step gains a
second outcome (a specification phase) and the bounded-clarification rule becomes the mechanism that
keeps it affordable.
