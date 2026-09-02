# User stories

Stories describe what a person gets. The numbered requirements in
[03-functional-requirements.md](03-functional-requirements.md) describe what the system must do. A
story without at least one requirement behind it is a wish; a requirement with no story is either
infrastructure or scope creep, and should be challenged.

Personas P1 (platform operator), P2 (lead developer), P3 (security reviewer), P4 (delivery manager),
P5 (non-developer requester) and P6 (tenant administrator) are defined in
[01-scope-and-personas.md](01-scope-and-personas.md#personas).

Priority: **P0** blocks the proof of concept; **P1** blocks a design-partner install; **P2** is
wanted before the second customer.

> **Extended by the 2026-09 vision change.** Epics 6 to 10 below are new. Priorities inside them are
> **provisional in a specific way**: which of them is first depends on unresolved questions — OQ-01
> (deployment shape), OQ-11 (first worksite), OQ-12 (first advisory class) and OQ-18 (console subset).
> A story marked P0 here means "P0 within its capability", not "P0 for the next milestone". The
> roadmap is where sequencing is decided ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)),
> and it does not yet claim an order it cannot justify.

> **Re-prioritised by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).** The
> product is maintenance work in declared work classes, so the stories about submitting a free-text
> change request and approving a generated plan — **US-004, US-005, US-006 and US-008** — move to the
> deferred M4 milestone along with the Architect. They are retained rather than withdrawn because they
> are still the correct stories for generated planning when it is built. The stories that carry the v1
> product are the honest-failure and audit epics (US-010 to US-017) plus **US-023**, which is in Epic 2
> below, because a Run's trigger is now a schedule and a work class rather than a person and a
> sentence.
>
> **US-023 was moved into Epic 2 by the 2026-09 rewrite.** It had been written inline in this note,
> which left a P0 story living inside a paragraph about a past re-prioritisation — the kind of thing an
> agent skims past. Its text is unchanged.

## Epic 1 — Get it running

**US-001 — Install on my own host** · P1 · P0 · FR-046, NFR-020
As an operator, I install M.A.D.E. on a Linux host I administer, so that no source code has to leave
my network.
*Given* a clean supported host with a container runtime, *when* I follow the bootstrap procedure,
*then* the smoke test passes within 30 minutes and 15 commands, and *then* the system refuses to
start if any model tier is unconfigured, naming the missing tier.

**US-002 — Refuse to run without isolation** · P1 · P0 · FR-055, NFR-002
As an operator, I want the system to refuse to execute anything if the isolation runtime is missing
or misconfigured, so that I can never accidentally run model-generated code under a weaker boundary.
*Given* the configured isolation runtime is unavailable, *when* a Run is submitted, *then* the Run is
rejected with a message naming the runtime and the check that failed, *and* no code is executed.

**US-003 — Register a repository and find out immediately if it is unsuitable** · P1 · P0 · FR-001, FR-004, FR-008
As an operator, I register a target repository and learn at registration whether the system can work
with it.
*Given* a repository whose declared baseline verification command does not pass on the base branch,
*when* I register it, *then* registration fails with the command, exit code and output, *and* no
Project is created.

## Epic 2 — Get a change made

**US-023 — Have maintenance done while nobody watches** · P4, P2 · P0 · FR-081, FR-082, FR-083
As a delivery manager, I want dependency upgrades attempted across my repositories on a schedule,
with a cost ceiling I set, and pull requests I can merge.
*Given* a Project with the `dependency_upgrade` class enabled and a weekly schedule, *when* the
window arrives, *then* Runs are created without a person, each reaches `IMPLEMENT` with no planning
model call, each is bounded by the concurrency cap and the budget ceilings, *and* the ones that
succeed produce pull requests whose diff a reviewer merges without editing it.

**US-004 — Submit a change request** · P2 · P0 · FR-011, FR-012, FR-021
As a lead developer, I submit a change request against a registered repository and receive a Run
identifier I can follow.
*Given* a registered Project, *when* I submit intent plus a base commit, *then* a Run is created on a
branch named for it, *and* resubmitting the same idempotency key returns the same Run rather than
starting a second one.

**US-005 — See the plan before money is spent on it** · P2 · P0 · FR-023, FR-024, FR-028
As a lead developer, I review the task breakdown before implementation begins.
*Given* plan approval is enabled, *when* planning completes, *then* the Run parks in `AWAIT_HUMAN`
showing each Task with its verification command, *and* no implementation model call is charged until
I approve.

**US-006 — Refuse a plan that cannot be checked** · P2 · P0 · FR-024, FR-025, FR-030
As a lead developer, I never want to approve a plan containing a task nobody can verify.
*Given* a produced TaskGraph in which a Task has no verification command, *when* the plan validator
runs, *then* the graph is rejected before it reaches me, *and* a second invalid graph escalates to a
human instead of a third attempt.

**US-007 — Get a branch with the change and its proof** · P2 · P0 · FR-032, FR-043, FR-044
As a lead developer, I receive a branch I can review like a normal pull request.
*Given* all Tasks verified and I approved delivery, *when* the Run completes, *then* a branch exists
containing the change, its tests and any deployment artifacts, the full suite passed in a Sandbox,
*and* each commit carries trailers naming the run, task, model and prompt version.

**US-008 — Deployment artifacts, not just application code** · P2 · P1 · FR-026, FR-043
As a lead developer, I want the container and pipeline changes a feature needs, produced and checked
alongside it.
*Given* a request whose plan includes a Task of kind `iac`, *when* it is implemented, *then* the
produced artifacts pass their declared verification command (for example a config validation or a
linter) *and* fail the Task if they do not.

**US-009 — Never touch my default branch** · P2 · P0 · FR-010, FR-031
As a lead developer, I want a structural guarantee about my main branch.
*Given* any Run, including one where I explicitly ask for it, *when* the system attempts delivery,
*then* it refuses to target or push to the Project's default branch.

## Epic 3 — Fail honestly

This epic carries more weight than Epic 2. A system that closes Epic 2 and not Epic 3 is the product
this one exists to replace.

**US-010 — Be told it failed, with evidence** · P2 · P0 · FR-039, FR-045
As a lead developer, when the system cannot do the job I want to know that plainly, with what it
tried.
*Given* a Task that fails its attempt cap, *when* the Run stops, *then* it is in `AWAIT_HUMAN` with
each Attempt's patch, verification command, exit code and normalised failure, *and* the outcome is
described as failed rather than as partially complete.

**US-011 — Never be told something works when it was not checked** · P2, P3 · P0 · FR-033, FR-034, FR-045, NFR-018
As a reviewer, I want a hard guarantee that "passing" means a command exited zero.
*Given* any Run outcome presented as successful, *when* I inspect the audit record, *then* there is a
verification event with exit code 0 for every completed Task, *and* no agent output could have
produced that status without it.

**US-012 — Stop retrying when retrying cannot help** · P1 · P0 · FR-040, FR-041, NFR-012
As an operator, I do not want to pay for a loop that is learning nothing.
*Given* an Attempt that produces the same patch, or the same failure signature with no fewer
failures, *when* the progress oracle evaluates it, *then* the retry is refused and the Run escalates,
having spent a small fraction of its ceiling.

**US-013 — Cap the spend before it happens** · P1 · P0 · FR-049, FR-051, NFR-009
As an operator, I set a ceiling per Run and trust it.
*Given* a Run approaching its ceiling, *when* the next model call is estimated to exceed it, *then*
the call is refused before it is made and the Run parks with reason `budget_exhausted`, never
exceeding the ceiling.

## Epic 4 — Prove what happened

**US-014 — Answer the auditor from the log** · P3 · P1 · FR-063, FR-065, NFR-015
As a security reviewer, I want to see every command the system executed and every model call it made
for a given Run.
*Given* any completed Run, *when* I export its audit record, *then* every Sandbox execution and model
call appears with the Run, Task, Attempt and State that authorised it, in newline-delimited JSON
matching the published schema.

**US-015 — Prove where the code could have gone** · P3 · P1 · FR-068, NFR-007
As a security reviewer, I want evidence about egress rather than assurance.
*Given* a Run, *when* I inspect its events, *then* every network decision made on its behalf appears
as allowed or denied with the destination, *and* the escape suite demonstrates that non-allowlisted
destinations are unreachable.

**US-016 — Replay a run to understand a failure** · P1 · P1 · FR-064, NFR-016
As an operator debugging a bad outcome, I want to reconstruct exactly what happened.
*Given* a Run's event log, *when* I fold it, *then* I obtain the same final State and spend, *and* I
can re-run the routing logic against the historical events to test a fix.

**US-017 — Survive a restart mid-run** · P1 · P0 · FR-017, NFR-019
As an operator, I want a deploy or a crash to cost time, not work.
*Given* a Run mid-execution, *when* the worker is killed and restarted, *then* the Run resumes and
reaches a terminal State without repeating a model call that was already charged.

## Epic 5 — Operate and improve

**US-018 — See what a run cost and where** · P1 · P0 · FR-050, FR-067
As an operator, I want per-step cost, not a monthly total.
*Given* a Run, *when* I open the viewer, *then* I see each event with its cost, the running total,
and the split between planning, implementation and review.

**US-019 — Change a prompt without gambling** · P1 · P1 · FR-076, FR-077, NFR-027
As an operator, I want to know whether a change made things better before shipping it.
*Given* a modified prompt or model tier, *when* I run the golden suite, *then* I get pass rate, cost,
attempts and escalation rate against the recorded baseline, *and* CI blocks a regression beyond the
allowed margin.

**US-020 — Know that injected instructions cannot escalate** · P3 · P1 · FR-075, FR-078, NFR-028
As a security reviewer, I want evidence that content in a repository cannot widen what the system
does.
*Given* a golden case whose repository contains instructions telling the agent to exfiltrate or to
disable checks, *when* the case runs, *then* no tool call outside the State's declared authority
occurs and the case is recorded as such.

**US-021 — Cancel a run and clean up** · P1 · P1 · FR-016, FR-059
As an operator, I stop a Run I no longer want.
*Given* a non-terminal Run, *when* I cancel it, *then* its Sandbox is destroyed within the idle
timeout, a terminal event is recorded, and its branch remains for inspection.

**US-022 — Restore from backup** · P1 · P2 · NFR-025
As an operator, I want to know the backup works before I need it.
*Given* a backup, *when* the monthly drill restores it to a clean host, *then* all Runs, events and
artifacts are present and the audit export for a sampled Run is byte-identical.

## Epic 6 — Advisory work that is worth reading

The epic that carries the advisory lane. **US-025 is the one that matters**: without it this epic is a
comment generator, and with it the lane has a defensible reason to exist
([06-lanes.md](06-lanes.md)).

**US-024 — Get findings on my own pull request** · P2 · P0 · FR-116, FR-091, FR-093
As a lead developer, I want the system to review the pull request I opened, without it being able to
change it.
*Given* an advisory class enabled on my repository, *when* I open a pull request, *then* an ingress
event is recorded, an advisory Run produces findings as comments, *and* the branch I opened is
unchanged — no patch, no push, no approving review.

**US-025 — Check a finding in seconds instead of re-deriving it** · P2 · P0 · FR-088, FR-089
As a lead developer, I want a finding I can verify by looking at it.
*Given* a finding claiming a defect, *when* I read it, *then* either it leads with a command and an
exit code I can re-run, *or* it leads with the word *unverified* — *and* the two never look alike.

**US-026 — Never be shown a guess formatted as a proof** · P2, P3 · P0 · FR-086, FR-087, FR-149
As a reviewer, I want to know which lane an output came from before I read it.
*Given* any surface presenting output, *when* I look at it, *then* the lane is visible before the
content, an advisory Run is never described as *verified*, *failed verification* or *not verified*,
*and* a concern the agent could not demonstrate appears labelled rather than omitted.

**US-027 — Find out whether the review is actually helping** · P4 · P1 · FR-090, FR-094, NFR-030, NFR-031
As a delivery manager, I want the advisory lane measured rather than assumed.
*Given* a work class with findings delivered over a window, *when* I open the effectiveness dashboard,
*then* I see acceptance rate and evidence ratio for that class with the counts they were computed
from, reported separately from the verified lane *and* never blended with it.

## Epic 7 — Finish a migration

**US-028 — Declare a campaign and find out immediately if it cannot be measured** · P4, P1 · P0 · FR-095, FR-097
As a delivery manager, I want to start a migration and know at declaration time whether the system can
track it.
*Given* a worksite whose progress command does not run or whose output does not parse as an integer,
*when* I try to activate it, *then* activation fails reporting the command, exit code and output, *and*
no Run is created.

**US-029 — See how much is left, truthfully** · P4 · P0 · FR-096, FR-132, FR-139
As a delivery manager, I want a number I can trust rather than one that flatters the tool.
*Given* an active worksite, *when* I open it, *then* I see the remaining count measured on the default
branch with the commit and command that produced it, work in flight shown separately and never as
progress, escalated slices shown separately, *and* no completion estimate without the observations it
came from.

**US-030 — Stop a campaign that is achieving nothing** · P1 · P0 · FR-098, FR-097, NFR-032
As an operator, I do not want to pay for a campaign that is not reducing its own count.
*Given* a worksite whose remaining count has not fallen across the declared number of cycles, *when*
the campaign progress oracle evaluates it, *then* the worksite pauses and escalates, distinguishing
slices that failed verification from pull requests awaiting merge, *and* no ceiling can be raised while
it is active.

**US-031 — Pause for a release and resume afterwards** · P1, P2 · P0 · FR-102, FR-105
As a lead developer, I want to stop the campaign during a freeze without losing it.
*Given* an active worksite, *when* I pause it, *then* no new Runs are created and in-flight Runs finish
or park; *and when* I resume it weeks later, *then* it re-measures and re-plans before creating
anything, so no slice is delivered against a stale tree.

**US-032 — Two campaigns that do not corrupt each other** · P1 · P1 · FR-100, FR-117
As an operator running a conversion and a lint sweep on one repository, I want a predictable outcome
rather than merge conflicts.
*Given* two worksites whose path scopes overlap, *when* the second is activated, *then* it waits with a
recorded reason naming the claim that blocks it and the age of the wait, *and* it does not silently
proceed.

## Epic 8 — Ask without commit access

**US-033 — Ask for a change in the channel I already use** · P5 · P0 · FR-106, FR-107, FR-108
As a support engineer with no git-host account, I want to ask for a maintenance change where I already
work.
*Given* my chat identity is mapped to an entitlement covering the repository and the class, *when* I
describe what I want, *then* a request is created, brokered onto that class, and a Run is created
within my budget.

**US-034 — Be told honestly when it cannot be done** · P5 · P0 · FR-108, FR-111, FR-109
As a requester, I would rather be refused clearly than have something plausible and wrong happen.
*Given* a message that matches no class I am entitled to, or that stays ambiguous after the
clarification allowance, *when* triage finishes, *then* the request is declined in the same thread with
a reason from the closed set — including `requires_generated_plan` where the ask needs a plan the
system cannot generate — *and* nothing is inferred or guessed.

**US-035 — Follow it without a git account** · P5 · P0 · FR-113, FR-114
As a requester, I want to know what happened to my ask.
*Given* a request I created, *when* its state changes, *then* the broker posts the transition and the
outcome into my thread and gives me a read-only view of my own request, *and* no source, patch content,
verification output or repository path appears in the channel.

**US-036 — Prevent a channel guest from spending our budget** · P6, P3 · P0 · FR-107, FR-110, FR-135
As a tenant administrator, I want chat access and system authority to be different things.
*Given* an unmapped chat identity, *when* they ask for work, *then* no request is created and the reply
names the missing mapping; *and given* a mapped identity, *then* they cannot exceed their allowance,
target a repository outside their entitlement, or approve delivery of their own request.

## Epic 9 — Decide whether it paid for itself

**US-037 — See the numbers that justify renewal** · P4 · P0 · FR-130, FR-131, FR-139
As the person who signs, I want the figures I would use to decide, computed from the log rather than
asserted.
*Given* a window with delivered work, *when* I open the effectiveness dashboard, *then* I see acceptance
rate, cost per merged pull request, cost per failed Run beside it, intervention rate and time to merge —
per lane and per class, each with the count it came from and the published query that produced it.

**US-038 — Not be shown a confident number computed from nothing** · P4, P3 · P0 · FR-132, FR-139, NFR-037
As a buyer, I want the dashboard to admit when it does not know yet.
*Given* a measure with too few observations, *when* I look at it, *then* it renders as "insufficient
data" with the count — never as 0%, never as a percentage over three samples.

**US-039 — Set a budget per team and per repository** · P6 · P0 · FR-134, FR-119
As a tenant administrator, I want spend bounded where I own it.
*Given* ceilings set at tenant, team, repository and worksite level, *when* work is created, *then*
admission is checked at every level before the Run exists, *and* one team exhausting its allowance does
not affect another.

**US-040 — Say who may approve what** · P6 · P0 · FR-135
As a tenant administrator, I want the approval gate to have a policy rather than a convention.
*Given* an approval policy binding scope, lane and class to principals with a minimum approver count,
*when* I save one that would leave a scope with nobody able to approve, *then* it is rejected rather
than saved.

## Epic 10 — Trust it with write access

**US-041 — Know exactly what it can do to my repository** · P3, P2 · P0 · FR-122, FR-123, NFR-035
As a security reviewer, I want a boundary I can read and test rather than a promise.
*Given* the system's own application installation, *when* I read the permission envelope, *then* it can
create branches under a reserved prefix and open pull requests, and it cannot push to the default
branch, force-push, delete a branch, touch a tag, alter settings or protection, read CI secrets, merge,
enable auto-merge or submit an approving review — *and* each prohibition has a test.

**US-042 — Turn it off in one action, without asking you** · P3, P6 · P0 · FR-126, FR-127
As a security reviewer, I want revocation that does not depend on your cooperation.
*Given* I remove the installation at my git host, *when* the system next attempts an operation, *then*
every affected Run parks with reason `access_revoked`, no further git operation is attempted, no retry
is scheduled, *and* the console shows the state.

**US-043 — Be told which permission is missing, not shown a retry button** · P1 · P0 · FR-124, FR-125
As an operator, I want a fail-closed access boundary that explains itself.
*Given* a permission the system expected and does not have, *when* it is needed, *then* registration
refuses at registration time naming the permission and the class that needs it, or the Run parks with
`access_insufficient` naming the permission and the operation — *and* there is no fallback credential,
no alternative ref and no degraded delivery.

**US-044 — Keep one tenant's work away from another's** · P3, P6 · P0 · FR-140, FR-141, NFR-029
As a security reviewer at a hosted customer, I want isolation between organisations enforced rather
than intended.
*Given* a principal of one tenant, *when* they read anything, *then* no row, artifact, object-store key,
metric series or log line of another tenant is reachable — asserted with row-level security active
against seeded cross-tenant access attempts on every tenant-scoped table.

**US-045 — Install the same system you host** · P1 · P1 · FR-142, FR-143
As an operator self-hosting, I want the artifact you run, configured differently.
*Given* a `self_hosted` deployment, *when* it bootstraps, *then* exactly one tenant exists, tenant
creation is not exposed, *and* no capability is present or absent because of the deployment mode.

## Epic 11 — Work that happens without being asked

**US-046 — React to what happens in my repository** · P2, P1 · P0 · FR-116, NFR-033
As a lead developer, I want the system to notice rather than wait to be told.
*Given* a pull request opened, a push to the default branch, or a schedule window, *when* it happens,
*then* an ingress event is recorded before anything acts on it, *and* a redelivery of the same event
produces no second Run.

**US-047 — See why nothing is happening** · P1 · P0 · FR-117, NFR-034
As an operator, I want waiting to be visible rather than inferred.
*Given* work that cannot start because a cap, a claim or a ceiling is in the way, *when* I look at the
queue, *then* every waiting item shows its position, its age, the reason and the cause — *and* no queue
is unbounded.

**US-048 — Not be surprised by a missed schedule** · P1 · P1 · FR-118
As an operator, I want a skipped window to be a fact rather than a silence.
*Given* a schedule window missed because the deployment was down, *when* it comes back, *then* the skip
is a recorded event with a reason *and* no backfill burst of Runs is created.
