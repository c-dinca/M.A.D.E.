# User stories

Stories describe what a person gets. The numbered requirements in
[03-functional-requirements.md](03-functional-requirements.md) describe what the system must do. A
story without at least one requirement behind it is a wish; a requirement with no story is either
infrastructure or scope creep, and should be challenged.

Personas P1 (platform operator), P2 (lead developer), P4 (delivery manager) and P3 (security reviewer)
are defined in [01-scope-and-personas.md](01-scope-and-personas.md#personas).

Priority: **P0** blocks the proof of concept; **P1** blocks a design-partner install; **P2** is
wanted before the second customer.

> **Re-prioritised by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).** The
> product is maintenance work in declared work classes, so the stories about submitting a free-text
> change request and approving a generated plan — **US-004, US-005, US-006 and US-008** — move to the
> deferred M4 milestone along with the Architect. They are retained rather than withdrawn because they
> are still the correct stories for generated planning when it is built. The stories that carry the v1
> product are the honest-failure and audit epics (US-010 to US-017) plus a new one below, because a
> Run's trigger is now a schedule and a work class rather than a person and a sentence.
>
> **US-023 — Have maintenance done while nobody watches** · P4, P2 · P0 · FR-081, FR-082, FR-083
> As a delivery manager, I want dependency upgrades attempted across my repositories on a schedule,
> with a cost ceiling I set, and pull requests I can merge.
> *Given* a Project with the `dependency_upgrade` class enabled and a weekly schedule, *when* the
> window arrives, *then* Runs are created without a person, each reaches `IMPLEMENT` with no planning
> model call, each is bounded by the concurrency cap and the budget ceilings, *and* the ones that
> succeed produce pull requests whose diff a reviewer merges without editing it.

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
