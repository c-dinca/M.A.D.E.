# ADR-0031 — Optimistic concurrency between Scenes; conflicts are detected at merge and the loser re-runs

**Status:** Accepted
**Date:** 2026-09-02
**Supersedes:** the exclusive path-claim mechanism in [ADR-0024](0024-worksites-as-long-running-campaigns.md)
**Relates to:** [ADR-0008](0008-search-replace-patch-format.md), FR-035, FR-105, NFR-044, [02-architecture.md](../02-architecture.md)

## Context

[ADR-0024](0024-worksites-as-long-running-campaigns.md) gave each campaign an exclusive claim on a
path prefix per repository: two campaigns could not hold overlapping scopes, and the second waited
visibly with a recorded reason. The alternative it rejected was silent conflicts, and on that
comparison it was right.

Its own negative section then recorded the cost honestly: *"Path-scope claims will block legitimate
work. A conversion campaign holding `src/` blocks a lint campaign from touching anything under it, and
the second campaign waits. The operator will experience it as the system refusing to do work it could
obviously do."*

That cost lands badly against what the product actually sells. The reason to have a swarm rather than
one agent is that work proceeds in parallel. A mechanism whose visible behaviour is *"your second
campaign is waiting"* undercuts the argument at the moment the customer is watching, and it does so on
a repository where the conflict was usually hypothetical.

Two facts about the first work class change the arithmetic. A dependency upgrade's diff is small — a
manifest, a lockfile, and a handful of call sites — so overlap in a shared prefix rarely means overlap
in the same lines. And a conflict, when it happens, is cheap to detect and cheap to redo, because the
Scene is minutes of work rather than hours.

## Decision

**Scenes run in parallel. Conflicts are detected at merge, and the loser re-runs automatically.**

- No exclusive claims. There is no claim registry, no prefix comparison at activation, and no waiting
  state whose cause is another Scene.
- **A Scene's patch is applied by exact match** ([ADR-0008](0008-search-replace-patch-format.md),
  [FR-035](../03-requirements.md)). A tree that moved underneath it produces a rejection with the file
  and the nearest candidate named — never a fuzzy apply. That existing rule *is* the conflict
  detector, and it is the reason this decision is affordable rather than reckless.
- **A Scene whose base commit is no longer the current head is re-planned against the current head**
  rather than delivered against a stale tree ([FR-105](../03-requirements.md)). Re-running is
  automatic and is a recorded event, not a silent retry: the Prompt Book shows that the Scene ran
  twice and why.
- **A re-run consumes the Scene's normal bounds.** It passes admission control
  ([FR-049](../03-requirements.md)), counts against the attempt cap
  ([FR-039](../03-requirements.md)), and is subject to the progress oracle
  ([FR-040](../03-requirements.md)). A conflict cannot become an unbounded retry loop, because the
  bounds that already exist do not care why an attempt is happening.
- **The re-run rate is measured** ([NFR-044](../03-requirements.md)), because it is the number that
  decides whether this decision was right.

## Alternatives considered

### Exclusive path claims, as ADR-0024 specified — rejected

Its case is correctness-first and it is not weak: a conflict that never happens costs nothing to
resolve. Claims catch the collision at activation, which is the cheapest possible moment — before any
model call, before any execution, before any spend. They also make the system's behaviour trivially
predictable, and predictability is worth a great deal when one person is debugging it.

Rejected because the cost falls on the common case to protect the rare one. For dependency upgrades
the collision is rare and the wait is guaranteed, so the mechanism spends visible product capability
on a risk that mostly does not materialise — and it spends it in front of the customer. ADR-0024
anticipated this objection in its own revisit trigger: *"the path-scope claim is observed blocking more
work than it protects."* This decision acts on that trigger with the first work class's diff size as
the evidence, rather than waiting to observe it.

### Optimistic, but merge conflicts escalate to a human instead of re-running — rejected

A real case, and the more conservative version of this decision: a conflict is information, and a
system that silently redoes work hides how often it is colliding.

Rejected because a human resolving a conflict between two of our own Scenes is supervision, which is
what the product exists to remove. The information objection is answered differently and better: the
re-run is a recorded event and the **re-run rate is a measured metric**, so the collision frequency is
visible without a person being interrupted by each one.

### Serialise all Scenes on a repository — rejected

The case: one Scene at a time per House removes conflicts entirely, needs no claim registry, and is
the simplest thing that works.

Rejected because it is the claim mechanism with a coarser granularity and therefore a worse version of
the option already rejected — it blocks *all* parallel work on a repository rather than only
overlapping work.

### Three-way merge or automatic conflict resolution — rejected

The case: git resolves most of these automatically, and refusing to try is leaving capability on the
floor.

Rejected on the same grounds as fuzzy patching. Automatic resolution is where a system starts
producing changes nobody authored, and a merge resolution that passes the suite is not evidence that
it was the right resolution. Re-planning from the current head produces a change an agent actually
decided on.

## Consequences

### Positive

Parallelism is real rather than nominal, which is the product's own argument. The mechanism is
*smaller* than what it replaces: no claim table, no overlap comparison, no waiting state, no
claim-release path on pause or failure — the conflict detector is the patch applier we already have.
And the collision rate becomes a measured number instead of a design assumption, so the decision can
be reversed on evidence.

### Negative — mandatory

**Wasted work is now a normal outcome.** A losing Scene has spent model calls and execution time and
produced nothing mergeable. That is the failed-Scene margin problem in a new place, and it scales with
how much parallel work runs against one House.

**The re-run rate is unknown.** The claim that collisions are rare rests on dependency-upgrade diffs
being small, which is reasoning rather than measurement. If it is wrong, the cost appears as spend
rather than as an error, which is the quieter of the two failure directions.

**A conflict can be discovered late.** Under claims it was caught before any spend; now it is caught
after the patch is generated, and sometimes after verification has run. The cheapest detection moment
was given up on purpose.

**Repeated collision on the same paths can look like progress.** Two Scenes taking turns re-running
against each other's merges would each individually pass every bound. The progress oracle and the
attempt cap bound the total, but the pattern is one to watch for and it did not exist before.

**One rejected option gets quietly harder to return to.** Removing the claim registry means
reinstating it later is building it, not re-enabling it — which is the honest cost of choosing the
smaller mechanism.

## Revisit when

**The measured re-run rate exceeds one in five Scenes** — that is, more than 20% of Scenes on a House
are re-planned because their base moved — sustained over a month of real work on at least three
repositories. At that point wasted work is no longer an occasional cost and exclusive claims become the
cheaper mechanism again.

The threshold is a judgement about where "occasional" stops, not a measurement, and it is stated as a
number so that the reversal is a check rather than an argument. What must be measured is the rate
itself ([NFR-044](../03-requirements.md)); it is reported from the first client.

Reverting also becomes correct sooner if a work class with large diffs is admitted — a language
conversion touches far more of a tree than a version bump, so the collision assumption behind this
decision does not transfer to it (**OQ-11**).
