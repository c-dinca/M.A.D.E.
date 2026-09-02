# Worksites

The founder's term is *șantier* — a worksite. It is the unit the buyer recognises: not "here is a pull
request" but "convert this codebase to TypeScript", "get every service off the end-of-life framework",
"remove the deprecated API from all of it".

A **worksite** is a bounded long-running campaign that converts a repository-wide objective into many
Runs, in one lane, across one or more repositories in one tenant
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)). It is the first entity in this
system whose lifetime is longer than a deploy.

Two things about it are unusual enough to state before anything else, because both are places where the
obvious design is the wrong one.

**A worksite creates Runs. It never creates Tasks** ([FR-099](03-functional-requirements.md)). Each Run
stays exactly what it has always been: one repository, one branch, its own Tasks, its own guards, its
own ceiling, its own audit trail. That is why worksites are additive rather than a rewrite, and it is
why failure attribution still works.

**Progress is measured on merged state** ([FR-096](03-functional-requirements.md)). A worksite's
completion moves when a human merges something, not when the system opens something. Delivered but
unmerged pull requests are reported as *work in flight* and never as progress.

## Anatomy

| Part | What it is |
| --- | --- |
| **Objective** | The declared end state, expressed as a target remaining count — almost always zero |
| **Progress command** | An argv vector, executed in a Sandbox on a named commit, whose output yields the integer count of remaining work ([FR-095](03-functional-requirements.md)) |
| **Scope** | The repositories and the path prefixes within each. Claimed exclusively ([FR-100](03-functional-requirements.md)) |
| **Slice rule** | How the remaining work is divided into independently deliverable units: per directory, per module, per file count, per service |
| **Work class** | The class each slice Run is created from. A worksite invokes a class; it does not replace one |
| **Ceilings** | Spend, Runs, wall-clock duration, and maximum concurrently open pull requests ([FR-097](03-functional-requirements.md)) |
| **Cycle** | One pass: survey, plan slices, create Runs, wait. Numbered from 1 |

### The progress command is the worksite's oracle

A worksite whose objective cannot be counted by a command is not a worksite
([FR-095](03-functional-requirements.md)). This is the work-class oracle rule
([05-work-classes.md](05-work-classes.md)) applied one level up, and it serves the same purpose: it
keeps "modernise this codebase" out.

Examples of a real progress command: the count of `.js` files under the scope; the count of violations
a lint rule reports; the count of services whose manifest still pins the old framework; the count of
call sites of a deprecated symbol. Each is a number a human can check by running the same command.

Examples that are not worksites, and why: *"improve test coverage"* — coverage is a number but the
objective has no end state, so it is a class run on a schedule rather than a campaign; *"clean up the
codebase"* — no command; *"make the app faster"* — a benchmark is a command but the target is a
judgement.

## Lifecycle

```
DRAFT ──► SURVEYED ──► ACTIVE ──┬──► PAUSED ──► ACTIVE
                                │        │
                                │        └──► ABANDONED
                                ├──► COMPLETED
                                └──► ABANDONED
```

**`DRAFT`** — declared and configured, nothing executed. Ceilings and scope are set here.

**`SURVEYED`** — the progress command has been executed once against the default branch to establish
the **baseline count**, and the slice rule has been applied to produce a first slice plan. A survey
spends a Sandbox execution and no model call. A worksite whose survey fails — the command does not run,
or its output does not parse as an integer — does not become `ACTIVE`; it reports the command, its exit
code and its output, exactly as Project registration does
([FR-004](03-functional-requirements.md)).

**`ACTIVE`** — cycles run. Each cycle re-executes the progress command, re-plans the remaining slices,
and creates Runs for as many slices as the ceilings and the open-pull-request cap allow.

**`PAUSED`** — no new Runs are created; Runs already in flight finish or park. Reached by a human, by
any ceiling breach, or by the worksite progress oracle. **A paused worksite requires a human decision
to continue** ([FR-103](03-functional-requirements.md)); there is no automatic resumption, because
every route into `PAUSED` other than a human is a signal that something needs deciding.

**`COMPLETED`** — the measured remaining count has reached the declared target.

**`ABANDONED`** — a human stopped it. Its branches and pull requests remain; nothing is deleted.

### Pause and resume

Both are durable and survive restarts, deploys and upgrades, because worksite state is rows and an
event log rather than anything held in a process ([FR-101](03-functional-requirements.md)).

**Resume re-surveys before creating anything** ([FR-102](03-functional-requirements.md)). The
repository moved while the worksite was paused — merges landed, including possibly its own — and a
slice plan computed against a stale tree is a plan to produce conflicts. This costs a Sandbox execution
on every resume, which means pausing and resuming frequently spends real money making no progress. That
is a deliberate trade and the alternative is worse.

The same rule applies within a cycle: a slice Run whose base commit has moved is re-planned rather than
delivered against a stale tree ([FR-105](03-functional-requirements.md)).

## Termination, which is the part that matters

A worksite is a loop **above** every bound this system had. Attempt caps, the progress oracle, the Run
budget ceiling and the wall-clock TTL are all per Run; a campaign that creates Runs is outside all of
them. This is the most direct route to
[UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) the architecture has
ever contained, and it arrives dressed as the product working.

Four ceilings, declared before the worksite starts, none raisable while it is active
([FR-097](03-functional-requirements.md)):

| Ceiling | Bounds | Breach |
| --- | --- | --- |
| Total spend | Money | `PAUSED`, escalate |
| Total Runs | Attempts at the objective | `PAUSED`, escalate |
| Wall-clock duration | Calendar time | `PAUSED`, escalate |
| Maximum concurrently open pull requests | Review load imposed on the customer | No new Runs created this cycle |

Raising a ceiling means editing the worksite configuration, which creates a new immutable version and
is recorded — the same rule as Project configuration ([FR-005](03-functional-requirements.md),
[FR-104](03-functional-requirements.md)). There is no in-flight override, for the same reason there is
no "just one more attempt" affordance
([05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md)).

### The worksite progress oracle

Ceilings alone permit an expensive campaign that achieves nothing, in exactly the way per-Task attempt
caps alone permit three identical expensive failures. So the worksite has its own progress oracle
([FR-098](03-functional-requirements.md)), by direct analogy with
[`GUARD_PROGRESS`](../02-architecture/05-orchestration-and-termination.md#guard_progress):

> If the measured remaining count has not fallen across a declared number of consecutive completed
> cycles, the worksite pauses and escalates.

A campaign that is not reducing its own count is thrashing at a larger scale. The count is measured on
merged state, so this guard fires both when the slices fail and when nobody merges them — and both are
reasons to stop and involve a human, though they need different responses. The escalation therefore
carries the split: how many slice Runs failed verification, and how many pull requests are waiting.

The declared cycle count is **TBD** and needs measurement, not a guess: too low and a worksite pauses
because a reviewer was on holiday, too high and it burns its ceiling learning nothing. What has to be
measured is the distribution of cycles-to-first-merge on a real repository
([04-non-functional-requirements.md](04-non-functional-requirements.md)).

## Concurrency: two worksites, one repository

Worksites claim a path scope per repository, and claims MUST NOT overlap
([FR-100](03-functional-requirements.md)). A conversion worksite holding `src/` blocks a lint worksite
from touching anything beneath it.

**The second claimant waits, visibly.** Its waiting is a recorded state with a reason and a cause, not
an invisible queue ([FR-117](03-functional-requirements.md)), so the operator can see that a worksite is
blocked, by what, and for how long.

The honest cost: this will block work the system could obviously do. Two campaigns editing different
files under the same prefix are usually fine, and the claim does not know that. A finer granularity
than a path prefix is conceivable and is not designed, because the cost of detecting conflicts
precisely has to be measured before it is worth paying
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md), revisit trigger). The alternative
that was rejected was silent conflicts, which is how a campaign produces a cascade of unmergeable pull
requests and nobody can say why.

Note what is **not** changed by any of this: **Tasks inside one Run still execute one at a time**
([FR-027](03-functional-requirements.md), and Seam 3 in
[15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)). Concurrency exists between
Runs and between worksites, never inside a Run.

## How progress is reported

Three numbers, always together, never collapsed into one
([09-web-interface-and-admin-console.md](09-web-interface-and-admin-console.md)):

**Remaining** — the last measured count, with the commit it was measured at and the command that
measured it. This is progress.

**Work in flight** — delivered but unmerged pull requests. This is not progress. It is the review debt
the worksite has created, and the maximum-open-pull-requests ceiling exists to bound it.

**Escalated** — slices that failed and are waiting for a human.

A worksite showing `remaining: 240, in flight: 38, escalated: 4` is telling the truth about a
situation that a single "84% complete" would hide. The uncomfortable consequence, stated in
[ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md) and repeated here because it will
come up in every conversation: **a worksite in a team with slow review looks like a failing
worksite.** There is no engineering fix. Reporting work in flight separately, and reporting human
intervention rate on the dashboard, is what makes the constraint visible and attributable instead of
blamed on the system.

**No completion estimate is published.** A remaining count and a burn rate invite a projection, and any
projection from a handful of cycles is a number we would be inventing. If the interface ever shows
one, it shows the cycles it was computed from beside it
([FR-139](03-functional-requirements.md)).

## Worksites in the advisory lane

A worksite is lane-scoped like everything else, and advisory campaigns are legitimate: "triage every
TODO in this repository", "review the last six months of merged pull requests for a known defect
pattern". The progress command still has to exist — count of untriaged TODOs, count of unreviewed
commits — and the output is findings rather than pull requests.

Two adjustments follow. The maximum-open-pull-requests ceiling becomes a maximum-open-findings ceiling,
because unread findings are the same review debt in a different shape. And progress means *triaged*,
not *fixed*: an advisory worksite reduces the count of un-examined items, and it cannot claim credit
for anything changing.

## What is deliberately not built

**A worksite is not a template, yet.** Applying a declared worksite to a new repository — "run the
TypeScript conversion we did for service A against service B" — is the obvious next thing and it is
**OQ-17**. It is not assumed here, because a template implies that the slice rule and the progress
command generalise across repositories, and nobody has checked whether they do.

**No cross-repository Run.** A Run operates on one repository
([05-work-classes.md](05-work-classes.md)). A worksite spanning several repositories creates several
Runs; it does not create one Run that touches several. Batching would make failure attribution
ambiguous, which is the same objection that keeps parallel Tasks out.

**No automatic ceiling escalation.** A worksite that runs out of budget stops. It does not request more,
does not borrow from the Project, and does not continue at a lower tier.

**No worksite-level model memory.** A worksite's state is rows and an event log. Nothing an agent
concluded in cycle 3 reaches cycle 4 except as a named artifact with a digest, which is what allowed
worksites to be added without reopening the prohibition on cross-Run learning
([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 7).

**No merging, ever.** A worksite's throughput is capped by the customer's merge capacity, and the
answer to "can it just merge the safe ones" is no
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

> **Open question OQ-11** — Which single work class should the **first** worksite support end to end.
> The candidates differ in ways that matter: a **lint-rule sweep** has the cleanest progress command
> and the most trivially independent slices, so it is the fastest to prove the machinery and the least
> impressive; an **API migration** has a real progress command and slices that genuinely interact,
> which is where the design either works or does not; a **language conversion** (the founder's
> JavaScript-to-TypeScript example) is the one a buyer wants and the one whose slices conflict most.
> **Blocks:** the first worksite backlog item, the slice rule that gets built, and the seed repository
> the integration suite needs. **Resolved by:** the founder naming one.

> **Open question OQ-17** — Whether a worksite should be a reusable **template** that can be applied
> to a new repository. **Blocks:** whether worksite configuration is a per-worksite row or a
> declaration with instances, which is a schema decision and therefore a contract change that should
> not be made twice. **Resolved by:** the founder stating whether the intended use is one campaign per
> repository or one declaration applied across an estate — and, if the latter, whether the progress
> command and slice rule are expected to be repository-independent.
