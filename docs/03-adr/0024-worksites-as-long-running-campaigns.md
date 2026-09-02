# ADR-0024 — A worksite is a bounded long-running campaign that creates Runs and measures progress on merged state

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), [ADR-0010](0010-termination-guards.md), [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md), [01-product/07-worksites.md](../01-product/07-worksites.md), FR-091 to FR-099

## Context

The founder's term is *șantier* — a worksite. The examples are "convert this codebase from JavaScript
to TypeScript" and "upgrade every service off the end-of-life framework". Neither is a Run. Each is
hundreds of Runs across weeks, spanning many pull requests and possibly many repositories, surviving
restarts, upgrades and the reviewer's holiday.

Nothing in the current specification models this. A Run is "one end-to-end execution of the state
machine against one repository, from a request to a terminal state"
([00-context/03-glossary.md](../00-context/03-glossary.md)), and the scale envelope assumes "a Run
duration of minutes". A worksite is the first entity in this system whose lifetime is longer than a
deploy.

Two properties of the existing design are directly threatened, and they are the two that matter most.

**Termination.** Every bound in this repository is per Run: attempt caps, the progress oracle, the
budget ceiling, the wall-clock TTL. A campaign that creates Runs is a loop *above* every one of those
bounds. A worksite that keeps opening pull requests nobody merges, or keeps retrying slices that cannot
pass, is the most direct route to [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)
that this architecture has ever contained — and it arrives dressed as the product working.

**Truthfulness about progress.** The tempting progress metric is pull requests opened, because it is
the number that goes up. It measures the system's activity, not the customer's outcome. A worksite that
is "80% complete" with two hundred unmerged pull requests has completed nothing and has created work.

## Decision

A **worksite** is a first-class entity: a declared, bounded campaign that converts a repository-wide
objective into many Runs, in one lane, across one or more repositories in one tenant.

**A worksite MUST declare a progress command** (FR-091). It is an argv vector, executed in a Sandbox on
a named commit, whose output yields an integer count of remaining work: files not yet converted, lint
violations outstanding, services still on the old framework. A worksite whose objective cannot be
counted by a command is not a worksite. This is the work-class oracle rule
([01-product/05-work-classes.md](../01-product/05-work-classes.md)) applied one level up, and it is
what keeps "modernise this codebase" out.

**Progress is measured on the default branch, not on opened pull requests** (FR-092). The progress
command runs against merged state. A worksite's completion percentage therefore only moves when a human
merges something. Opened, un-merged pull requests are reported separately as *work in flight*, never as
progress.

**A worksite is bounded by four ceilings, all declared before it starts** (FR-093): total spend, total
Runs, wall-clock duration, and maximum concurrently open pull requests. Breaching any of them pauses
the worksite and escalates; none of them may be raised while it is active. Raising a ceiling means
editing the worksite configuration, which creates a new immutable version and is recorded — the same
rule as Project configuration ([FR-005](../01-product/03-functional-requirements.md)).

**A worksite has its own progress oracle** (FR-094), by direct analogy with
[`GUARD_PROGRESS`](../02-architecture/05-orchestration-and-termination.md#guard_progress). If the
measured remaining count has not fallen across a declared number of consecutive completed cycles, the
worksite pauses and escalates. A campaign that is not reducing its own count is thrashing at a larger
scale, and the reason the per-Run guard exists applies unchanged.

**A worksite creates Runs; it never creates Tasks** (FR-095). Each Run stays exactly what it is today:
one repository, one branch, its own Tasks, its own guards, its own ceiling, its own audit trail. This
is deliberate and it is the whole reason worksites are additive rather than a rewrite — failure
attribution stays per Run, and no existing guard changes.

**A worksite claims a path scope per repository, and claims MUST NOT overlap** (FR-096). Two active
worksites cannot hold overlapping path scopes in the same repository at the same time. The second
claimant waits, visibly, and its waiting is a recorded state with a reason — not an invisible queue.

**Worksite state is rows and an append-only worksite event log** (FR-097), folded the same way a Run's
is ([09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)). It is not model memory, not a
carried-over context, and not a summary an agent wrote. Nothing an agent concluded in one Run reaches
another Run except as a named, digested artifact. This is what keeps Seam 7's prohibition on cross-Run
learning intact while still letting a campaign survive a restart.

**Pause and resume are durable, and resume re-surveys** (FR-098). Pausing stops the creation of new
Runs; in-flight Runs finish or park. Resuming re-executes the progress command before creating anything,
because the repository moved while the worksite was paused and a slice plan computed against a stale
tree is a plan to produce conflicts.

**A worksite terminates.** `COMPLETED` when the remaining count reaches the declared target,
`ABANDONED` when a human stops it, `PAUSED` on any ceiling or the progress oracle. There is no state in
which a worksite continues indefinitely without a human decision (FR-099).

## Alternatives considered

### Model a campaign as one very long Run — rejected

The case is genuinely attractive: no new entity, no new event log, no new ceilings, and every existing
guard applies without modification. The Run already has a task graph, so a campaign is "just" a graph
with four hundred Tasks, and `TASK_SELECT` already walks one.

Rejected on three grounds that compound. The wall-clock TTL and the budget ceiling would have to grow
by orders of magnitude, which turns the two strongest bounds in the system into numbers so large they
stop bounding anything. Delivery is per Run — one branch, one pull request, one approval — so a
four-hundred-Task Run produces one enormous unreviewable pull request, or needs a per-Task delivery
mechanism that is a worksite by another name. And failure attribution collapses: with hundreds of
Tasks in one Run, "which Task broke the suite" stops being answerable, which is exactly the objection
[15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) raises against parallel Tasks.

### A schedule plus a work class, with no campaign entity — rejected

A real case, and it is close to free: the scheduler already exists ([FR-082](../01-product/03-functional-requirements.md)),
work classes already exist, and "run the TypeScript conversion class weekly against this repository"
would produce the same pull requests over time. No new concept, no new ceilings, no new document.

Rejected because a schedule has no memory of the objective and therefore cannot measure progress, know
when it is finished, or stop. It would run forever, produce a pull request per cycle regardless of
whether the last one merged, and have no answer to "how much is left" — which is the single question
the buyer asks about a migration. It also has no way to claim a path scope, so two schedules against
the same repository would collide silently.

### Let the worksite decompose into Tasks inside one graph per cycle, rather than into Runs — rejected

The case: a cycle's worth of slices genuinely belongs together, and one graph per cycle keeps
`TASK_SELECT` and `INTEGRATE` as the only sequencing machinery.

Rejected because it makes a cycle's pull request an all-or-nothing unit: one failing slice fails
`INTEGRATE` and the whole cycle delivers nothing, when the correct behaviour is that nineteen slices
merge and one escalates. Independent deliverability per slice is the property that makes a long
migration tractable for the reviewer, and it requires a Run per slice.

### Measure progress on pull requests opened rather than merged — rejected

The advocate's case is not stupid: the system controls what it opens and does not control what a human
merges, so measuring merged state makes the product's headline number depend on the customer's review
capacity. A worksite could be working perfectly and show zero progress because nobody reviewed
anything, which is a bad demo and a hard conversation.

Rejected because it is the same class of untruth as reporting a Task successful without an exit code.
An unmerged pull request has produced no value and has consumed review attention; counting it as
progress means the dashboard is measuring our activity and presenting it as their outcome. The
uncomfortable version is the true one, and the review-capacity problem it exposes is real and better
surfaced than hidden — which is why open pull requests are reported as work in flight, and why the
maximum-open-pull-requests ceiling exists.

## Consequences

### Positive

The product acquires the unit of work the buyer actually recognises — "convert this codebase" rather
than "here is a pull request" — without changing a single per-Run guarantee. Progress becomes a number
measured by executing a command on merged state, which is the same kind of claim as everything else
here and is defensible in front of the person paying. The worksite progress oracle extends the
project's best termination idea to the level where it was newly missing. And the path-scope claim gives
a real answer to concurrent campaigns rather than hoping they do not collide.

### Negative — mandatory

**A new and larger unbounded-spend surface exists, and its bounds are new code.** Every per-Run guard
in this repository has been reasoned about for a long time; the worksite ceilings and the worksite
progress oracle have not. They are the least-tested bounds in the system and they sit above the most
expensive loop, which is the worst combination available.

**Progress measured on merged state makes the headline metric partly the customer's responsibility.**
A worksite in a team with slow review will look like a failing worksite. That is honest and it will
still be blamed on us, and there is no engineering fix — only the separate reporting of work in flight
and the human-intervention metric on the dashboard.

**Path-scope claims will block legitimate work.** A conversion worksite holding `src/` blocks a lint
worksite from touching anything under it, and the second worksite waits. The alternative was silent
conflicts, so this is the right trade, but the operator will experience it as the system refusing to do
work it could obviously do.

**Re-surveying on every resume costs a Sandbox execution and wall-clock time**, so pausing and
resuming a worksite is not free, and a worksite paused and resumed frequently spends real money making
no progress.

**Worksite state is a second thing to fold, back up, retain and replay.** The audit story now has two
event logs, and every rule about the Run log — additive evolution, no mutation path, no checkpoint
reads on audit paths — has to hold for the second one too, in code nobody has written yet.

**"How long will this take" becomes a question we are expected to answer.** A worksite with a
remaining count and a burn rate invites an estimate, and any estimate we publish is a projection from
a handful of cycles. The specification refuses to state one; the interface will be under pressure to.

## Revisit when

Either: measured merge rate within a worksite is high but the campaign still fails to reduce its
remaining count — which would mean the slice decomposition is wrong and the worksite class needs
re-declaring, not the ceilings raising; or the path-scope claim is observed blocking more work than it
protects, in which case a finer claim granularity than a path prefix is worth designing, with the
conflict-detection cost measured first.
