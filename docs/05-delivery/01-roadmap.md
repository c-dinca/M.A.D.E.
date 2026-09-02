# Roadmap

Milestones are defined by capability and gated by exit criteria, not by dates. The sequence is a
dependency argument: each milestone removes the risk that would invalidate the next one's work.

> **Re-derived after the 2026-09 vision change.** Six capabilities arrived at once, and the largest
> risk this created is not technical — it is that the product ships as six half-things, which is worse
> than one finished thing ([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md),
> claim 1c). The response is more milestones, each smaller and independently demonstrable, and an
> honest statement about what the ordering does **not** claim.
>
> **Milestone identifiers are not renumbered.** M0 through M4 keep their meanings, including M4 as the
> deferred generated-planning milestone that
> [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) refers to. New milestones
> take `M3c` to `M3g`, extending the convention M3b already established, and the shared prefix is
> accurate: they are peers, not a chain.

## What this ordering does not claim

**The order within the M3 family is not decided**, because four open questions decide it and none has
been answered: **OQ-01** (which deployment shape ships first), **OQ-11** (which work class the first
worksite supports), **OQ-12** (which advisory capability ships first) and **OQ-18** (what the console
contains first). Each M3x milestone below states what it is blocked on.

A roadmap that asserted an order here would be inventing four answers. What *is* decided is the
dependency structure: nothing in the M3 family can precede M3b, and M2b precedes anything hosted.

**No milestone below has a date, and none is claimed to be small in effort.** "Small" here means one
demonstrable capability with checkable exit criteria — not cheap.

## Sequencing rationale

**Isolation before agents (M1 before M3).** The isolation boundary is the highest-risk unknown and the
one whose failure invalidates everything built on it. Discovering late that the runtime cannot be
installed on the target platform (OQ-08), or that Sandbox creation is too slow to be usable, would
waste every milestone above it.

**Tenancy before anything hosted (M2b before M6 in hosted form).** `tenant_id NOT NULL` in every unique
constraint and index, with row-level security, is cheap before any row exists and is a migration under
load afterwards — which is the entire reason
[ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) was taken now. It is
sequenced early even if OQ-01 resolves to self-hosted, because a self-hosted install exercises the same
boundary the hosted one depends on.

**Deterministic core before models (M2 before M3).** Tools, patch application, normalisation and the
guards are all testable without a model, and they are what the model's output flows through. Building
them first means that when the first agent runs, a failure is attributable to the prompt rather than
to an ambiguity about which layer is wrong.

**Guards with the first model call, not after (M3).** Cost controls retrofitted onto a working agent
are always incomplete, because the code was not written to ask permission. This is the specific
mistake that produces the overnight-budget incident, and it is cheap to avoid only if done first.

**One verified capability before anything else (M3b before the rest of the M3 family).** Worksites,
advisory findings and the chat front door all create Runs or consume the same delivery path. Building
any of them before one verified Run reliably reaches a merged pull request means debugging a campaign
and a Run at the same time.

**Residency before campaigns (M3c before M3d).** A worksite is a driver on top of durable ingestion,
visible queues and durable scheduling. Building the campaign first would mean building a private,
untested version of each.

**One agent before five (M3 before M4).** Multi-agent coordination adds failure modes on top of
single-agent failure modes. Debug them separately.

**Evaluation before optimisation (M5 before any prompt tuning).** Without a baseline, every prompt
change is anecdote and every "cheaper model" change silently raises total cost by adding attempts
([NFR-027](../01-product/04-non-functional-requirements.md)).

**Contracts before consumers, always.** Every new entity — lane, worksite, request, finding, evidence
record, tenant, ingress event — is absent from [`/contracts/`](../../contracts/), which is normative. The
contract changes land alone and first ([02-backlog.md](02-backlog.md)), and **no implementation item for
a new entity is startable until they do.** This is a real gate on M2b onward, not a formality.

## M0 — Foundations and contracts

*Capability: the shape of the system exists and is exercisable end to end with fakes and no model
calls.*

Contracts published and parsing; artifact schemas; database schema and migrations; the event log with
fold and lease; the compiled graph with pure routing over fake agents and a fake sandbox; the four API
endpoints; the CLI skeleton; CI with `spec-lint`.

**Exit criteria**

- A Run completes `INTAKE → DONE` using the fake agent and fake sandbox providers, with no network.
- Killing the worker mid-Run and restarting reproduces the identical State by folding events.
- Property tests show every `(State, event)` pair is handled and every failure edge reaches a terminal
  State or `AWAIT_HUMAN` — no self-loops.
- `spec-lint` passes: contracts parse, state names agree across contract, DDL and code, links resolve.

## M1 — Isolation proven

*Capability: model-generated code can be executed with a boundary we can demonstrate.*

`SandboxProvider` against the real runtime; the pinned base image with dependencies baked in; the
fail-closed preflight; resource limits and both TTLs; the reaper; the full escape suite; measured
creation latency committed to `bench/`.

**Exit criteria**

- Every escape case passes against the real runtime and the real image
  ([NFR-002](../01-product/04-non-functional-requirements.md)).
- The system refuses to execute when the runtime is unavailable, and this is asserted by a test.
- No credential and no network reachable from inside a Sandbox
  ([NFR-005](../01-product/04-non-functional-requirements.md),
  [NFR-006](../01-product/04-non-functional-requirements.md)).
- Sandbox create-to-ready measured over 50 creations and within
  [NFR-001](../01-product/04-non-functional-requirements.md), with results committed.
- Orphaned Sandboxes are provably reclaimed within the idle timeout.
- OQ-08 resolved: the supported host matrix is recorded and the suite has passed on the platform a
  design partner would actually use.

## M2 — Deterministic core

*Capability: a hand-written patch flows through the whole pipeline and is verified, with no model
involved.*

The toolbelt with per-State authority; the search/replace parser and applier; the patch policy
validator; the failure normaliser and signature; the tree-sitter repo map; the verification executor;
all six guards; the cost ledger with admission control against a fake price table.

**Exit criteria**

- A hand-written patch flows `apply_patch → lint → run_verification → TestReport` end to end.
- Adversarial patch inputs — traversal, symlink, oversized, CI-configuration — are all rejected.
- The same failing test produces an identical `failure_signature` across two Sandboxes.
- Guards are 100% branch covered and refuse: a repeated patch, a repeated signature with no
  improvement, a repeated state tuple, and an over-budget call.
- A `VERIFY`-state toolbelt cannot construct a write tool, asserted by a test.

## M2b — Tenancy enforced

*Capability: the isolation boundary between organisations exists and is demonstrably not bypassable,
in a deployment with one tenant or several.*

`tenant_id NOT NULL` on every tenant-scoped table, in every unique constraint and every index serving a
tenant-scoped query; row-level security policies; tenant resolution from the authenticated principal;
tenant-prefixed object-store paths and metric labels; users, teams, principals and entitlements;
bootstrap creating exactly one tenant in `self_hosted` mode.

Sequenced before any of the M3 family, because it is a schema property and schema properties are cheap
before data exists and a migration under load afterwards
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). It is sequenced here
**even if OQ-01 resolves to self-hosted**, because a self-hosted install exercises the same boundary the
hosted one depends on — which is what lets one test suite certify both.

**Exit criteria**

- Seeded cross-tenant access attempts against **every** tenant-scoped table return nothing, with
  row-level security active ([NFR-029](../01-product/04-non-functional-requirements.md)).
- A deliberately predicate-less tenant-scoped query is **refused by the database**, not silently
  answered — asserted by a test, because that is the failure mode application filtering hides.
- Two synthetic tenants hold colliding branch names, artifact digests and work-class names without a
  constraint violation, proving `tenant_id` is in every unique constraint.
- A static check over `made/store/` finds no tenant-scoped query without its predicate.
- An artifact digest from one tenant does not resolve for another
  ([FR-144](../01-product/03-functional-requirements.md)).
- `self_hosted` bootstrap creates exactly one tenant and the API exposes no tenant creation
  ([FR-142](../01-product/03-functional-requirements.md)).
- No module outside `made/config/` reads `deployment_mode`, asserted by the import-boundary lint
  ([FR-143](../01-product/03-functional-requirements.md)).

## M3 — First agent loop

*Capability: a natural-language request produces a verified change to one Task, with real cost control.*

The LLM client with tiers, metering, idempotency, fallback and structured output; the budgeted
cache-ordered prompt assembler; the Developer agent; the run viewer; per-Run cost reporting.

**Exit criteria**

- A request with a human-written Task produces a verified patch, under a declared ceiling.
- The unsatisfiable variant terminates in `AWAIT_HUMAN` within the attempt cap and under 25% of the
  ceiling ([NFR-012](../01-product/04-non-functional-requirements.md)).
- A Run whose budget is exhausted mid-flight stops cleanly with an accurate ledger and never exceeds
  its ceiling.
- Every model call has an event and a ledger row; the reconciliation query returns zero orphans.
- Cached-token ratio measured and reported.

## M3b — The first verified work class, the access envelope, and delivery

*Capability: a scheduled `dependency_upgrade` produces a merged pull request with no human edit, through
an identity whose permissions can be printed and revoked. This is the first sellable capability and
everything else in the M3 family depends on it.*

Work-class registry with fixed task templates and declared lanes; the `dependency_upgrade` class
including the manifest and lockfile consistency rule; the scheduler inside the existing worker; durable
`AWAIT_HUMAN` with recorded approvals; **the scoped application identity and its permission envelope**;
git delivery through the control plane; commit trailers. No Architect, no `SPEC`, no `PLAN`, no plan
approval.

**Exit criteria**

- A scheduled Run bumps a dependency, fixes what the bump breaks, and passes the repository's own suite
  in a Sandbox.
- A patch modifying a manifest without a consistent lockfile update is rejected
  ([FR-083](../01-product/03-functional-requirements.md)).
- A Run created from a work class reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`
  ([FR-081](../01-product/03-functional-requirements.md)).
- Scheduled Runs respect the concurrency caps and every budget ceiling — the case those guards exist for
  ([FR-082](../01-product/03-functional-requirements.md)).
- **One test per prohibition in the permission envelope**, each asserting the attempt fails inside our
  code and never reaches the host ([FR-123](../01-product/03-functional-requirements.md),
  [NFR-035](../01-product/04-non-functional-requirements.md)).
- Registration refuses a repository whose required permissions are absent, naming the permission and the
  class that needs it ([FR-124](../01-product/03-functional-requirements.md)).
- **Revoking access at the git host parks affected Runs with `access_revoked` and schedules no retry**,
  demonstrated by actually revoking it ([FR-126](../01-product/03-functional-requirements.md)).
- No push to a default branch is possible, no push occurs without a recorded approval, and no approving
  review is ever submitted.
- **The acceptance-rate measure exists and is verified against a hand-checked sample** spanning a
  rebase, a squash and a concurrent unrelated commit
  ([NFR-039](../01-product/04-non-functional-requirements.md)). Until this is done the headline number
  is unverified, and every kill criterion below depends on it.
- **OQ-09 is resolved.** Nothing in this milestone runs without it.

## M3c — Residency: ingestion, visible queues and durable scheduling

*Capability: work starts because something happened, not because someone asked — and an operator can
see why nothing is happening.*

Ingress endpoints on `api` with signature verification and idempotency on the provider's delivery
identifier; the ingress event log; the bounded work queue with position, age, reason and cause;
four-level concurrency and spend admission before Run creation; durable schedules with recorded skips;
polling as a configured alternative to inbound.

**Blocked on:** nothing beyond M3b. **Blocks:** M3d, and the reactive half of M3e.

**Exit criteria**

- A pull request opened on a target repository produces a recorded ingress event before any work starts,
  and a redelivery of the same event produces **no second Run**
  ([NFR-033](../01-product/04-non-functional-requirements.md)).
- An ingress event that will produce nothing — unmapped identity, no class enabled, all worksites paused
  — is still recorded, with the reason. "We saw it and did nothing, because X" is answerable.
- With the deployment at capacity, a trigger enqueues visibly: a row with position, age, reason and
  cause, exposed on the console and countable as a metric
  ([NFR-034](../01-product/04-non-functional-requirements.md)).
- A queue at its bound sheds with a recorded reason rather than growing.
- A human API request at capacity still receives `429`, unchanged.
- A missed schedule window is a recorded skip and produces **no backfill burst**
  ([FR-118](../01-product/03-functional-requirements.md)).
- Admission is checked at all four levels before the Run row exists, asserted by a test that no
  unadmittable Run is ever created.
- No clock read appears in any routing predicate, guard or campaign oracle, asserted by the
  forbidden-call check — the four new time-bearing mechanisms are the reason this is re-asserted here.
- **The ingestion alert fires** when no ingress event arrives from a configured source within the
  interval, demonstrated by stopping the source
  ([02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)).

## M3d — The first worksite

*Capability: a declared campaign reduces a measured remaining count to zero across many pull requests
and several weeks, and stops on its own if it is not making progress.*

Worksite entity and versioned configuration; the worksite event log and its fold; the survey and cycle
loop; the slice rule; exclusive path claims; the four ceilings; the campaign progress oracle; durable
pause and resume with re-survey.

**Blocked on: OQ-11** — which work class the first worksite supports. The candidates differ in ways that
change the slice rule and the seed repository, so this cannot start on a guess. **Blocked on M3c.**

**Exit criteria**

- A worksite whose progress command does not run, or whose output does not parse as an integer, **fails
  to activate**, reporting the command, exit code and output
  ([FR-095](../01-product/03-functional-requirements.md)).
- Across at least three cycles on a seed repository, the measured remaining count falls **only when
  pull requests are merged**; delivered-but-unmerged work is reported as work in flight and never as
  progress ([FR-096](../01-product/03-functional-requirements.md)).
- A worksite whose remaining count does not fall across the declared number of cycles pauses and
  escalates, and the escalation distinguishes failed slices from unmerged pull requests
  ([FR-098](../01-product/03-functional-requirements.md)).
- No ceiling can be raised while the worksite is active; each of the four is demonstrated tripping
  ([NFR-032](../01-product/04-non-functional-requirements.md)).
- Two worksites with overlapping path scopes: the second waits with a recorded reason naming the
  blocking claim and the wait's age ([FR-100](../01-product/03-functional-requirements.md)).
- Pause, restart the worker, resume: the worksite re-surveys before creating anything and delivers
  nothing against a stale tree ([FR-102](../01-product/03-functional-requirements.md)).
- Folding the worksite event log reproduces its state, cycle number, counts and spend exactly
  ([NFR-041](../01-product/04-non-functional-requirements.md)).
- **The cycle count for the progress oracle is set from measurement, not judgement**
  ([NFR-040](../01-product/04-non-functional-requirements.md)) — recorded from this worksite's own
  history, which is the only place the number can come from.

## M3e — The first advisory class

*Capability: findings on a human's pull request that a reader can check in seconds, or that say plainly
they could not be checked.*

The `ASSESS` state and its evidence-workspace-scoped toolbelt; the finding and evidence entities with
their distinct event kinds; the evidence executor reusing the verification executor and the shared
normaliser; finding delivery as pull-request comments; the evidence ratio metric; the `advisory` eval
tier.

**Blocked on: OQ-12** — which advisory capability ships first. **Blocked on M3b**, and on M3c for the
reactive trigger.

**Exit criteria**

- On a seed repository containing a real defect that no existing test catches, the class produces a
  finding whose evidence is a test that **fails on the branch and passes on its base**.
- On a pull request with **no** defect, the class produces no finding. This is the case that catches a
  model rewarded for finding things, and it is a required fixture.
- A concern with no executable form is emitted labelled `unverified` — **not suppressed**
  ([FR-149](../01-product/03-functional-requirements.md)).
- `demonstrated` and `unverified` findings are rendered differently, and the advisory Run is **never**
  described as *verified*, *failed verification* or *not verified*
  ([FR-086](../01-product/03-functional-requirements.md),
  [FR-089](../01-product/03-functional-requirements.md)).
- The reviewed branch is provably untouched: no patch, no push, no approving review, asserted by tests
  and by an escape case ([FR-091](../01-product/03-functional-requirements.md)).
- An evidence record does not appear as a verification event, does not satisfy INV-2, and cannot mark a
  Task successful (INV-12, INV-13).
- An advisory Run is bounded by budget admission, the attempt cap and the TTL exactly as a verified Run
  ([FR-093](../01-product/03-functional-requirements.md)).
- **The evidence ratio is measured and recorded as the baseline for
  [NFR-030](../01-product/04-non-functional-requirements.md).** It is expected to be uncomfortable. The
  response to a low number is to narrow the concern types the class emits, **not** to relax the label.

## M3f — The console and the effectiveness dashboard

*Capability: a buyer can answer "did this save us more than it cost" from published queries, and an
administrator can say who may spend what.*

Server-rendered pages for Runs, worksites, requests, findings, the queue and repository access status;
budgets and alert thresholds at four levels; approval policy; users, teams and roles; audit export; the
effectiveness dashboard.

**Blocked on: OQ-18** — what the first version contains. Partly forced by OQ-01: a hosted deployment
needs users, teams and roles on day one and a self-hosted one does not.

**Exit criteria**

- Every measure in [FR-130](../01-product/03-functional-requirements.md) is computed from the event log
  by a **published query**, and running that query by hand reproduces the displayed figure
  ([FR-131](../01-product/03-functional-requirements.md)).
- Every measure displays the count it was computed from, and a measure with too few observations renders
  as "insufficient data" — **never as 0% and never as a percentage over three samples**
  ([FR-139](../01-product/03-functional-requirements.md),
  [NFR-037](../01-product/04-non-functional-requirements.md)).
- No figure is blended across lanes, asserted by a test
  ([FR-094](../01-product/03-functional-requirements.md)).
- Every display rule in [FR-132](../01-product/03-functional-requirements.md) is asserted.
- An approval policy that would leave a scope with no eligible approver is **rejected rather than
  saved** ([FR-135](../01-product/03-functional-requirements.md)).
- A requester cannot approve delivery of their own request.
- The `auditor` role can export and cannot start work; the `requester` role sees only their own request
  ([FR-136](../01-product/03-functional-requirements.md)).
- No console endpoint exists that the published API does not, and none executes anything on demand
  ([FR-137](../01-product/03-functional-requirements.md)).
- No cross-tenant figure is computed without recorded consent
  ([FR-138](../01-product/03-functional-requirements.md)).
- No separate frontend build or deployment artifact exists
  ([FR-133](../01-product/03-functional-requirements.md)).

## M3g — The chat front door

*Capability: a person with no git-host account gets a merged change, or an honest decline with a reason,
in the channel they already use.*

The request entity and its event log; entitlements administered per identity; the Triager with no
repository access; bounded clarification; the closed decline-reason set; one chat adapter; the posting
allowlist; the requester's scoped read-only view.

**Blocked on: OQ-12** (whether this is the first advisory capability), **OQ-22** (which platform), and
constrained by **OQ-19** — until that is answered this milestone delivers the narrow front door, and
the honest description is "ask for a declared kind of maintenance, in plain language".

**Exit criteria**

- An unmapped chat identity creates **no** request and receives a decline naming the missing mapping
  ([FR-107](../01-product/03-functional-requirements.md)).
- A message matching an entitled class produces a Run within the requester's allowance.
- A message matching no class is declined with `requires_generated_plan` or `no_matching_class`, in the
  originating thread, recorded as an event — and **the decline reason distribution is queryable**, which
  is the instrument that answers OQ-19.
- An ambiguous message is declined after its clarification allowance and **never proceeds on an inferred
  value** ([FR-111](../01-product/03-functional-requirements.md)).
- The clarification allowance and TTL are never exceeded
  ([NFR-038](../01-product/04-non-functional-requirements.md)).
- **No source, patch content, verification output, repository path, file name or finding body is ever
  posted**, asserted against a seeded corpus
  ([NFR-036](../01-product/04-non-functional-requirements.md)).
- The system posts only into threads it was addressed in
  ([FR-150](../01-product/03-functional-requirements.md)).
- A requester follows their request without a git-host account and gains no repository access
  ([FR-113](../01-product/03-functional-requirements.md)).
- A chat post failure is recorded and the request is **never reported as answered**.
- An injection-bearing message produces at most a Run of a class the requester was already entitled to
  invoke, with parameters they could have supplied directly — asserted by the `chat_triage` eval tier.

## M4 — Multi-agent and generated planning (deferred behind first revenue)

*Still not on the critical path, and the trigger is now measurable rather than a principle.* Build only
when work classes stop covering demand — evidenced by the recorded frequency of
`requires_generated_plan` declines from M3g, which is why that reason code exists
([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 4).

**This milestone is what OQ-19 decides.** The chat front door needs exactly what it contains: turning a
non-developer's free text into a specified task. Until OQ-19 is answered the narrow front door ships and
US-004, US-005, US-006 and US-008 stay parked here
([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)).

*Capability: a free-text request that no work class covers produces a plan and then a pull request.*

The Architect producing Spec and TaskGraph with mandatory oracles; the DevOps and Reviewer roles;
`TASK_SELECT` topological execution; `INTEGRATE` with the full suite; plan approval.

**Exit criteria**

- A prose request produces a branch and a pull request with no hand-written Task, after two approvals.
- A plan containing a Task without a verification command is rejected before implementation.
- A two-Task request with a dependency between the Tasks succeeds.
- OQ-07 resolved by measurement, since generated verification commands are the whole risk of this
  milestone.

## M5 — Evaluation, hardening and first install

*Capability: changes can be made safely, and someone other than the author can run it.*

The golden suite across every tier with three repetitions, including the `advisory` and `chat_triage`
tiers; committed baselines and the comparison gate; the adversarial repositories; nightly invariant
queries and audit reconciliation across all three event logs; backup and restore drill; the bootstrap
timing job; the operator runbook.

**Exit criteria**

- The harness runs unattended nightly with results committed.
- A prompt or tier change can be evaluated before merge, and CI blocks a regression beyond
  [NFR-027](../01-product/04-non-functional-requirements.md).
- Zero authority violations across the adversarial tier
  ([NFR-028](../01-product/04-non-functional-requirements.md)).
- INV-1 to INV-18 implemented as SQL checks with a fixture violating each, including the tenancy, lane
  and worksite invariants.
- Restore drill reproduces a deployment on a clean host with a byte-identical audit export for a
  sampled Run, a sampled worksite and a sampled request.
- Bootstrap on a clean VM completes within
  [NFR-020](../01-product/04-non-functional-requirements.md).
- **Acceptance rate measured per work class and per lane**, verified against
  [NFR-039](../01-product/04-non-functional-requirements.md)'s hand-checked sample. This is the gating
  measurement rather than golden-task pass rate, because it is the same question asked in the buyer's
  terms ([NFR-042](../01-product/04-non-functional-requirements.md)).
- **Baselines recorded for the `TBD` measures**: the evidence ratio
  ([NFR-030](../01-product/04-non-functional-requirements.md)), advisory acceptance rate
  ([NFR-031](../01-product/04-non-functional-requirements.md)) and the worksite cycle count
  ([NFR-040](../01-product/04-non-functional-requirements.md)). **Recording them is the exit criterion;
  hitting a particular value is not**, because no honest value exists to require yet.

## M6 — Design-partner install

*Capability: someone else's work, in whichever deployment shape ships first.*

**Blocked on OQ-01.** The exit criteria differ by shape and both sets are stated, because writing only
one would be assuming the answer.

Not started until M5's measured acceptance rate clears
[NFR-026](../01-product/04-non-functional-requirements.md) and
[NFR-042](../01-product/04-non-functional-requirements.md), because installing below it means asking a
customer to supervise rather than to delegate.

**Exit criteria, both shapes**

- A design partner's own private repository produces reviewable pull requests without operator
  intervention.
- Their security reviewer can answer "what did it execute, what could it reach, and what can it do to
  our repository" from the audit export and the permission envelope alone.
- Revocation demonstrated by the customer, unilaterally, with affected work parking and no retry
  ([FR-126](../01-product/03-functional-requirements.md)).
- OQ-02, OQ-05 and OQ-06 resolved by contact with a real customer.

**Additional exit criteria if self-hosted**

- Bootstrap performed by the customer, within [NFR-020](../01-product/04-non-functional-requirements.md),
  on their platform — which requires OQ-08 resolved.
- An upgrade performed by them across one release, with a worksite in flight surviving it.

**Additional exit criteria if hosted**

- **OQ-10 resolved.** The execution boundary must be adequate for running several tenants' code, and if
  it is not, this shape does not ship on it — hosted operation is suspended rather than the boundary
  weakened ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).
- Two real tenants coexist with the escape suite's cross-tenant cases passing against the live
  deployment.
- A `platform` principal can administer tenants and can read none of their source, events, artifacts,
  findings or exports.
- OQ-02 answered as **our** obligation rather than the customer's, because we now hold their source.
- OQ-23 resolved, and OQ-14 resolved or explicitly deferred with the onboarding consequence stated.

## Kill and pivot criteria

Decided now, while it is still cheap to be honest. **Each criterion is measured by the effectiveness
dashboard**, which is why that dashboard is a requirement rather than a reporting nicety
([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)) — and why
[NFR-039](../01-product/04-non-functional-requirements.md) matters: a criterion computed from a wrong
denominator, in the flattering direction, is worse than no criterion.

**Acceptance rate (verified lane).** If fewer than 70% of a work class's pull requests merge without a
human editing the diff, that class is a suggestion engine with extra steps.
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) has already taken the pivot
this criterion used to prescribe — narrowing to a task class with a strong oracle — so the next
narrowing is *within* the class: patch and minor upgrades only, no breaking changes. **Narrow, do not
broaden.**

**Unit economics.** If cost per merged pull request exceeds roughly a quarter of what the buyer would
plausibly pay, there is no room for support or for a model price rise. Attack context and caching first
([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)); if that fails, narrow
the scope.

**Human intervention rate.** If more than 40% of Runs need a human to make progress, the product is
supervision rather than automation. Either reposition honestly as a supervised assistant, or narrow the
class.

**Isolation.** Any escape-suite failure that cannot be closed within the chosen boundary stops
everything until it is closed or the boundary is replaced. This is the one criterion with no trade-off
available, and hosted operation is subject to it twice over: **if the boundary is inadequate for
multi-tenant execution, the hosted shape does not ship** (OQ-10).

Four criteria added by the vision change. Each names the response, because a criterion with no
prescribed response gets argued about at the moment it fires.

**Worksite completion.** If a worksite cannot reduce its measured remaining count to its target within
its declared ceilings, on a real repository with a real reviewer, campaigns are not a product. The
response is to **narrow the slice rule** — smaller slices, fewer at a time — before touching a ceiling,
because a ceiling raised to make a campaign finish is the failure this whole architecture exists to
prevent. If narrowing does not work, the honest read is that the class is not suited to a campaign.

**Advisory acceptance.** If findings are dismissed at a rate that makes reading them cost more attention
than they save, the advisory lane is the failure mode of its own category. The response is to **narrow
the concern types the class emits**, and specifically to the ones that can carry evidence — **never to
relax the `unverified` label**, which is the whole differentiation
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). The measurement is slow and
statistical by construction, so this criterion fires late; that is a property of work with no oracle,
not a scheduling error.

**Evidence ratio.** If the first advisory class is overwhelmingly `unverified` findings, review by
evidence did not work as specified. The response is to narrow the class to demonstrable concern types.
If **no** concern type is demonstrable, the class should not ship — an advisory class with no evidence
form is inadmissible ([01-product/05-work-classes.md](../01-product/05-work-classes.md)).

**Chat front-door usefulness.** If recorded declines cluster on `requires_generated_plan`, the narrow
front door is not the product the founder described. That is **not** a kill signal — it is the trigger
for OQ-19, and it is exactly what the reason code was built to measure. It becomes a kill signal only if
declines cluster there *and* generated planning is judged unaffordable, in which case the front door
should be withdrawn rather than shipped as something it is not.

## What no criterion above tests

**Whether anybody wants this.** No milestone tests it; only a customer does
([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)). The vision
change widened the product and did not change that, and the question of whether buyers distinguish
"unattended, budgeted, audited" from "we already have Cursor" is still answerable this week by three
conversations rather than by any amount of building.

**Whether one maintainer can build six capabilities.** This is the risk the vision change created and
no exit criterion detects it — a milestone can pass while the aggregate is unfinishable. The only
instruments are the open questions that force one choice each (OQ-01, OQ-11, OQ-12, OQ-18) and the
willingness to stop after the first capability that works.
