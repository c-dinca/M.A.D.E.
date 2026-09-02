# Scenio

**Scenio does maintenance work that a command can prove, and a human approves the result.**

A CVE lands in a dependency. The upgrade that fixes it breaks four call sites. Scenio raises the
dependency, fixes what broke, and the repository's own existing test suite decides whether it worked —
then opens a pull request for a person to merge. It never merges anything itself.

*the rehearsal is the work*

**Status: specification only. No code exists yet.**

---

## What v1 is

One kind of work in each of two lanes, and nothing else
([ADR-0033](docs/03-adr/0033-one-verified-lane-one-judgement-lane.md)):

**Verified — dependency upgrades and CVE remediation.** A command declared before the work starts
decides the outcome. The CVE disappears from the dependency tree, the suite stays green, and both are
checkable by a machine.

**Judgement — review of a human's pull request, through evidence only.** Scenio writes the test that
fails and demonstrates the problem, or it marks the comment unverified. It never posts an opinion
formatted as a finding.

**Judgement output carries no correctness guarantee, and the interface says so in those words.** The
verified lane's guarantee is only worth something if it is scoped honestly.

It runs as **one isolated instance per client, operated by us** — not a shared multi-tenant service
([ADR-0029](docs/03-adr/0029-hosted-first-one-instance-per-client.md)). A client's work never sits in a
row next to another client's, because it never sits in the same database.

## The specification

Eight documents. They can be read end to end, which is the point.

| Document | What is in it |
| --- | --- |
| [01-product.md](docs/01-product.md) | The problem, who it is for, the non-goals, and the Scenio brand and vocabulary |
| [02-architecture.md](docs/02-architecture.md) | The loop, the three actors, isolation, concurrency, the Prompt Book, Box Office |
| [03-requirements.md](docs/03-requirements.md) | 25 functional and 10 non-functional requirements, and the twelve surviving stories |
| [04-contracts.md](docs/04-contracts.md) | The normative contracts, and `CON-01`–`CON-06`: what has to change in them first |
| [05-roadmap.md](docs/05-roadmap.md) | Three milestones, each independently demonstrable |
| [06-open-questions.md](docs/06-open-questions.md) | The three that stay open, and what flips if each does |
| [07-deferred.md](docs/07-deferred.md) | Everything cut, one line and a reason each |
| [Decision records](docs/03-adr/README.md) | All 33 ADRs, kept. Decision history is cheap and losing it is expensive |

**Start with** [01-product.md](docs/01-product.md) for the vocabulary — every theatre term carries its
plain description — then [02-architecture.md](docs/02-architecture.md).

`AGENTS.md` is the operating rules for an agent about to do work. Read it first if that is you.

## The vocabulary, in one line each

The theatre term is the title; the plain description always follows it. Full table in
[01-product.md](docs/01-product.md).

**House** a connected repository · **Show** a long-term maintenance campaign · **Scene** one task
within a Show · **Rehearsal Room** the isolated execution environment · **Dress Rehearsal** the
verification run · **Preview** the pull request · **Opening Night** the merge · **The Call** the human
approval gate · **Held** a Scene waiting for a person · **Dropped Cue** a Scene that failed ·
**Booth** the console · **Prompt Book** the audit log · **Box Office** the four effectiveness numbers.

Not *Production* for a campaign. In a developer tool that word means the live environment, and the
ambiguity produces incidents.

## The three open questions

They are commercial bets, not technical ones, and each would take part of the specification with it if
it flips. [06-open-questions.md](docs/06-open-questions.md) says exactly how much.

**OQ-11** — is dependency and CVE work the right first lane, or are large migrations? *Provisional:
dependencies.* If it flips, M2's exit criteria change and campaigns return from Deferred.

**OQ-15** — does the security-perimeter argument lead, or follow? *Provisional: it follows.* If it
flips, hosted-first reverses and self-hosted becomes first.

**OQ-19** — is a narrow chat entry point enough, or does it need to accept any request? *Provisional:
narrow.* This is a real reduction from the original vision, not a postponement.

---

## The working rule

> **No new commits in `docs/` until code runs against a real repository.**

The specification is finished. Every new document from here is a day Scenio does not exist.

This is a rule the owner has set for himself, and it is the part that makes the cut hold rather than
being a moment that passes. Three things are worth knowing about it:

**It is not a rule against thinking.** It is a rule against writing thinking down instead of building.
The eight documents are enough to build M1 from. If something in them is unclear, that is a defect to
fix in place, not a reason for a ninth document.

**An ADR is the exception.** A decision that is not written down is a decision that gets made again,
usually differently. Recording one costs a page and saves a week
([docs/03-adr/README.md](docs/03-adr/README.md)).

**Growth is depth inside the eight, not new files.** When M1 works and M2 needs detail the
architecture document does not have, it goes into the architecture document.

## What this repository does not claim

**Nothing here has ever run.** The contracts parse, apply to a real database and reject hostile
inserts — but they describe a *larger* product than v1 and predate three of the decisions above, so an
agent implementing from them today would build the wrong thing. `CON-01`–`CON-06` fix that and they
land first ([04-contracts.md](docs/04-contracts.md)).

**Two numbers are `TBD` and stay that way.** Box Office's four measures and the re-run rate have
defined measurements and no values, because none has been observed. A plausible invented figure would
be indistinguishable from a measured one later, and Box Office is shown to clients.

**Twenty questions were closed and three were kept.** The three are exposure the owner chose to keep
visible. A specification claiming total certainty about a product that has not started would be the
dishonest version.
