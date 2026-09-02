# ADR-0033 — v1 is one verified lane and one judgement lane; the specification is cut to eight documents

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** OQ-11, OQ-12, OQ-15, OQ-19, [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md), [ADR-0022](0022-two-lanes-verified-and-advisory.md), [07-deferred.md](../07-deferred.md)

## Context

Six capabilities arrived in one revision — the judgement lane, campaigns, a chat front door, a
console, hosted multi-tenancy and event-driven residency — and the specification grew to 79 documents,
150 functional requirements, 42 non-functional requirements and 23 open questions to describe them.

The evidence register named the risk this created and ranked it first: *"Six capabilities can be built
by one maintainer before the money or the attention runs out. If false, the product ships as six
half-things, which is worse than one finished thing."* It also noted that no exit criterion detects
this — a milestone can pass while the aggregate is unfinishable.

There is a second cost that is easier to miss. A specification of that size is itself a liability when
it is ahead of any running code: every document is a claim to keep true, every cross-reference is a
thing that can go stale, and an agent reading 79 documents spends its context on reading rather than
on building. Nothing in the repository has ever run.

## Decision

**v1 is one verified lane and one judgement lane. Everything else is deferred.**

- **The verified lane** is dependency upgrades and CVE remediation, verified by the repository's own
  existing test suite (provisional; **OQ-11**).
- **The judgement lane** is review of a human's Preview, exclusively through evidence (**OQ-12**,
  decided).
- **Everything else moves to [07-deferred.md](../07-deferred.md)** as one line with a reason: campaigns
  as templates, the chat front door beyond its narrow form, extra agent roles, generated planning,
  multi-repository work, self-hosted packaging, test generation, scheduling, and the rest.

**The specification is cut to eight documents**: a README, product, architecture, requirements,
contracts, roadmap, open questions, and the deferred ledger. **All ADRs are kept** — decision history
is cheap and losing it is expensive — and those whose subject is now deferred are marked suspended
rather than deleted.

**The requirement test is one sentence.** A requirement survives only if it is necessary for **one CVE
to disappear from one real repository through a Preview a human approved.** That produced 25 functional
requirements from 150, and 10 non-functional from 42.

**Exactly three open questions remain** — OQ-11, OQ-15 and OQ-19 — because they are commercial bets
rather than technical ones and the founder wants the exposure visible. Every other question is either
answered by a decision or retired alongside the scope that produced it.

**And a working rule, which is the part that makes the cut hold:** no new commits in `docs/` until code
runs against a real repository.

## Alternatives considered

### Keep the specification and sequence the capabilities — rejected

The strongest case. Nothing in the 79 documents is wrong; each capability is individually justified,
each requirement traces to a test, and the roadmap already ordered them into small milestones with
checkable exit criteria. Cutting throws away work that was done carefully, and a specification is
cheap to carry compared with code — it has no runtime, no dependencies and no upgrade path. The four
open questions that forced one choice each (OQ-01, OQ-11, OQ-12, OQ-18) were already the mechanism for
avoiding six half-things.

It loses on a distinction the earlier version did not make: **a specification is not free when it is
the only thing that exists.** Every document is a claim someone must keep true, and 150 requirements
describing capabilities nobody has built is 150 opportunities for the documentation to drift from a
product that has not started. The open questions bounded what would be *built* first; they did nothing
about the volume of prose that had to be maintained meanwhile. The judgement here is that a small
specification and running code beats a complete specification and none.

### Cut to one lane only — rejected

The case: the verified lane alone would be smaller still, and the judgement lane is the one with no
oracle, no quality gate and a measurement that takes weeks to become meaningful
([ADR-0022](0022-two-lanes-verified-and-advisory.md) records all of that). Dropping it would remove the
weakest guarantee in the product.

Rejected because the judgement lane is the cheapest door to a first client: reviewing a Preview needs
no write access to be tried, so a prospect can run it without a security conversation. Under the
evidence requirement it is also small — the Prompter produces the failing test or says nothing —
and it is the capability that distinguishes this from a comment generator. One lane each is the
smallest set that has both a way in and a thing to sell.

### Cut the requirements but keep the document structure — rejected

The case: the 79 documents encode reading paths, role boundaries and per-topic depth that a reader
navigates by. Collapsing them into eight loses the map.

Rejected because the map was sized for a product with six capabilities and four personas. With one
lane each and two roles, the per-topic documents were mostly cross-references to each other, and the
reading paths existed to stop an agent reading everything. Eight documents can be read in full, which
removes the need for a map.

## Consequences

### Positive

The specification can be read end to end, which is the property that makes it usable by an agent with
a context window and by a founder in an evening. The 25 surviving requirements are all load-bearing
for the one thing v1 does, so a failing one means a broken product rather than a broken feature.
Nothing is lost: every cut is a line in the deferred ledger with the reason and, where it applies, the
scope that would reopen it. And the working rule converts the cut from a moment into a constraint.

### Negative — mandatory

**Capability that was specified is now specified only as a title.** Campaigns, the chat front door,
the console beyond a minimal Booth and Box Office, extra roles, generated planning — each survives as
one line. Rebuilding the detail means rewriting it, and the second draft will not be the first one.
That is the deliberate cost.

**Depth was lost along with volume.** The cut documents carried arguments that the eight cannot hold at
the same length — the threat model's named adversaries, the failure-mode tables, the query rules, the
per-persona surfaces. The ADRs retain the decisions; they do not retain all of the reasoning that
surrounded them.

**Three open questions are now carrying more weight each.** With 20 closed, the remaining three are
the entire uncertainty surface, and two of them — OQ-11 and OQ-15 — would each invalidate a large part
of the roadmap if they flip. A shorter specification makes each bet more visible and also more
consequential.

**The no-new-documents rule will be inconvenient exactly when it is working.** The first time a real
decision needs recording, the rule says to write code first. ADRs are the exception, and that
exception is the pressure point.

**Cutting 125 requirements includes cutting judgement calls that may be wrong.** Some of the
requirements now in Deferred will turn out to have been necessary, and the discovery will be a defect
rather than a review comment.

## Revisit when

A capability in [07-deferred.md](../07-deferred.md) is required by a paying client, or one of OQ-11,
OQ-15 or OQ-19 flips and takes part of the roadmap with it. In either case the reopening is an ADR and
a requirement, not a return to the previous structure — **the eight documents are the shape from here,
and growth is depth inside them rather than new files.**
