# Roadmap

Three milestones. Each is independently demonstrable and each exit criterion is checked by running
something ([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)).

**No dates.** "Small" here means one demonstrable capability, not cheap.

**Contracts first.** `CON-01` to `CON-06` ([04-contracts.md](04-contracts.md)) are hard blockers. The
contracts currently describe a larger product than v1, so an agent implementing from them today would
build the wrong thing. No implementation item is startable before the contract item it depends on has
merged.

---

## M1 — The empty loop

*A hand-written task, a container, a command, an exit code, a log. No agents. No model.*

This milestone builds the Stage Manager — the orchestrator, which is code and holds no prompt — and
nothing that thinks. If the loop is wrong, every agent built on top of it is debugging two problems at
once.

Blocked by: CON-01, CON-02, CON-04, CON-05.

**Exit criteria**

- A hand-written patch flows through the loop: Rehearsal Room created, patch applied, declared command
  executed, exit code recorded, room destroyed. **A test that fails becomes a test that passes**, and
  the transition is visible in the Prompt Book ([FR-033](03-requirements.md),
  [FR-063](03-requirements.md)).
- **The Prompt Book contains every command that ran**, with its argv, exit code and duration.
  Reconciliation returns zero executions without an entry ([NFR-015](03-requirements.md)).
- The Prompt Book cannot be edited: the application role has no UPDATE and no DELETE grant, asserted
  by a test that tries ([FR-062](03-requirements.md)).
- Removing the container runtime makes Scene creation **refuse**, with the failed check named, and
  nothing executes ([FR-055](03-requirements.md), [NFR-002](03-requirements.md)).
- No credential-shaped value is present inside a live Rehearsal Room, against a seeded corpus of at
  least 20 formats ([FR-056](03-requirements.md), [NFR-005](03-requirements.md)).
- Egress is denied by default: HTTP, raw TCP, DNS and link-local metadata attempts all fail from inside
  the room, and each produces a recorded Prompt Book entry
  ([FR-057](03-requirements.md), [NFR-007](03-requirements.md)).
- An exact-match patch whose target has changed is **rejected** with the file and nearest candidate
  named — no fuzzy apply exists in the implementation, asserted by whitespace-only and near-miss cases
  ([FR-035](03-requirements.md)).
- Connecting a House whose declared command does not pass on its base branch **fails the connection**,
  reporting the command, exit code and output ([FR-001](03-requirements.md),
  [FR-004](03-requirements.md)).

---

## M2 — The first lane

*The Crew raises a dependency, the suite stays green, a Preview is opened.*

The first model calls, the first delivery, and the permission envelope. Blocked by: M1, CON-03 not
required, CON-06 not required.

**Exit criteria**

- On a seed House with a CVE in a transitive dependency, a Scene raises the dependency, fixes what the
  upgrade breaks, and the repository's **own existing suite** passes in a Rehearsal Room
  ([FR-081](03-requirements.md), [FR-083](03-requirements.md)).
- **Ten real upgrades across three repositories**, with the acceptance rate measured and published
  ([FR-130](03-requirements.md), [NFR-043](03-requirements.md)). Recording the number is the criterion;
  a particular value is not, because none has been observed.
- The measured acceptance rate is **verified against a hand-checked sample** spanning a rebase, a
  squash and a concurrent unrelated commit ([NFR-043](03-requirements.md)). A disagreement in the
  flattering direction is treated as a defect.
- A patch modifying a manifest without a consistent lockfile update is **rejected**
  ([FR-083](03-requirements.md)).
- A Scene reaches the change step with **zero model calls** spent on planning, asserted by counting
  model-call entries ([FR-081](03-requirements.md)).
- Nothing is pushed and no Preview is opened without a recorded approval and a record of what the
  approver was shown ([FR-032](03-requirements.md)).
- A push to the default branch is **impossible even when explicitly requested**
  ([FR-010](03-requirements.md)).
- Scenio authenticates as **its own installation**, and a personal access token is rejected at
  configuration time ([FR-122](03-requirements.md)).
- **One test per prohibition** in the permission envelope, each asserting the attempt fails inside
  Scenio's own code and never reaches the git host
  ([FR-123](03-requirements.md), [NFR-035](03-requirements.md)).
- **Revoking Scenio's access at the git host** makes the affected Scenes Held, schedules no retry, and
  attempts no further git operation — demonstrated by actually revoking it
  ([FR-126](03-requirements.md)).
- A Scene whose budget is exhausted mid-flight stops cleanly with an accurate ledger and never exceeds
  its ceiling ([FR-049](03-requirements.md), [NFR-009](03-requirements.md)).
- Forcing an identical patch twice is refused by the progress oracle; the attempt cap is reached and
  the Scene becomes Held rather than attempting again
  ([FR-039](03-requirements.md), [FR-040](03-requirements.md), [NFR-010](03-requirements.md)).
- No Scene reports success without a verification entry with exit code 0, asserted as a database
  invariant ([NFR-018](03-requirements.md)).
- Two Scenes on one House whose bases collide: the loser's patch is **rejected by exact match** rather
  than fuzzily applied, it is re-planned against the current head, the re-plan is a recorded Prompt
  Book entry, and the re-run rate is reported
  ([FR-035](03-requirements.md), [NFR-044](03-requirements.md)).

---

## M3 — The first client

*A minimal Booth, Box Office with the four numbers, the Prompter working through evidence.*

Blocked by: M2, CON-03, CON-06.

**Exit criteria**

- **A paying client, one instance, one month.** Their own repository, their own instance, upgrades
  merged.
- **Box Office reports all four numbers**, each computed from the Prompt Book by a **published query**
  that reproduces the displayed figure when run by hand, and each carrying the count it came from
  ([FR-130](03-requirements.md), [FR-132](03-requirements.md)).
- A measure with too few observations renders as "insufficient data" with its count — never as 0% and
  never as a percentage over a handful of samples ([FR-132](03-requirements.md)).
- On a Preview containing a real defect that no existing test catches, the Prompter produces a comment
  whose evidence is **a test that fails on the branch and passes on its base**
  ([FR-088](03-requirements.md)).
- **On a Preview with no defect, the Prompter produces no comment.** This is the case that catches a
  model rewarded for finding things, and it is a required fixture.
- A concern with no executable form is emitted **labelled `unverified`, not suppressed**, and the two
  states render differently ([FR-088](03-requirements.md), [FR-132](03-requirements.md)).
- The reviewed branch is provably untouched: no patch, no push, no approving review — asserted by a
  test and by an escape case ([FR-080](03-requirements.md), [FR-123](03-requirements.md)).
- A judgement-lane Scene is **never** described as *verified*, *failed verification* or *not verified*,
  and no Box Office figure is blended across lanes ([FR-132](03-requirements.md)).
- The Booth has **no endpoint the published API does not**, and none executes anything on demand
  ([04-contracts.md](04-contracts.md), CON-06).

> **M3 needs a price, and there is no pricing decision in this specification.** A paying client
> requires a number to charge, and hosted operation with one instance per client means infrastructure
> cost per client is not near zero ([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)).
> The decisions document did not set a price and none is invented here. This is a prerequisite for M3
> that the documentation does not supply — recorded in [07-deferred.md](07-deferred.md) rather than
> guessed at.

---

## What is not in these three milestones

Shows as long-running campaigns, Show templates, Front of House, multi-repository work, self-hosted
packaging, extra agent roles, generated planning, scheduling, test generation, an evaluation harness,
and every Booth page beyond the four above. All of it is in [07-deferred.md](07-deferred.md) with a
reason.

**Nothing in these milestones is gated on a number nobody has measured.** Where a measurement is an
exit criterion — acceptance rate, re-run rate, evidence rate — **recording it is the criterion and a
target value is not**, because inventing a threshold to pass a milestone is indistinguishable from
measuring one afterwards.

## What no exit criterion tests

**Whether anybody will pay for this.** M3's paying client is the only test, and it is the last one.

**Whether the CVE lane is the right first bet.** [OQ-11](06-open-questions.md) — if large migrations
are what clients actually want, M2's exit criteria and half of M1's recipe work change.

**Whether one maintainer can finish three milestones.** No criterion detects the aggregate running
out of time. The instruments are the cut itself and the working rule in the
[README](../README.md): no new documents until code runs.
