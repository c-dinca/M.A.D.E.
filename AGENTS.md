# AGENTS.md — operating rules

Read this before anything else. It is short on purpose; everything it points at is longer.

## What this project is

M.A.D.E. is an environment in which a swarm of role-specialised agents lives inside a company's
development infrastructure — GitHub repositories, a container runtime, chat, the hosts they already run
— and continuously takes over the work that consumes developer time. It runs **unattended**, it reacts
to events rather than waiting to be asked, and everything it delivers arrives as a branch and a pull
request for a human to merge. It never merges anything itself.

Read [ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md) and then
[ADR-0021](docs/03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) through
[ADR-0028](docs/03-adr/0028-web-console-as-a-product-surface.md) before you write code. The second set
was written together for the September 2026 vision change; what reversed, what survived and what is now
open is in [00-context/06-vision-change-2026-09.md](docs/00-context/06-vision-change-2026-09.md). **If
you remember this file saying something different, read that first.**

### The distinction everything rests on

Work is in one of **two lanes**, declared per work class and never inferred
([01-product/06-lanes.md](docs/01-product/06-lanes.md),
[ADR-0022](docs/03-adr/0022-two-lanes-verified-and-advisory.md)):

**Verified** — a command declared in advance decides the outcome. The exit code is the arbiter. Every
mechanism in this repository was built for this and is unchanged.

**Advisory** — no such command exists: review, bug-finding, TODO triage, turning a chat message into a
change request. **There is no exit code for "is this review good".** The agent proposes, a human
decides, quality is measured statistically. Advisory output carries **no correctness guarantee** and
says so.

The failure to prevent, in one sentence: **advisory output borrowing the credibility of verified
output.** The pressure for it will not come from an attacker. It will come from whoever is trying to
make a summary look tidy, and it will arrive as a reasonable request.

## Source of truth, in order

When two things disagree, the higher one wins and the lower one is a defect to be fixed:

1. **[`/contracts/`](contracts/)** — the machine-readable contracts. Normative.
2. **Accepted ADRs** in [`docs/03-adr/`](docs/03-adr/README.md) — the settled decisions.
3. **Documents** in [`docs/`](docs/README.md) — everything else.
4. **Existing code** — which may be wrong, and is the *last* thing to trust.

If a document contradicts a contract, fix the document in the same pull request. Do not implement the
document.

> **One exception is live right now and you must know about it.** Every entity the 2026-09 vision change
> introduced — lane, worksite, request, finding, evidence record, tenant, user, entitlement, ingress
> event, work queue, claim, git operation — is **absent from `/contracts/`**. The prose is ahead of the
> contract, which under the hierarchy above means the prose has no normative form yet. The fix is
> `CON-01` to `CON-06` in [the backlog](docs/05-delivery/02-backlog.md), which land **alone and first**.
> **Until the relevant `CON-` item has merged, an implementation item for a new entity is not ready —
> stop and report.**

## The five unforgivable failures

Everything below exists to prevent one of these
([system overview](docs/02-architecture/01-system-overview.md#the-five-unforgivable-failures)):

**UF-1** code escapes the Sandbox · **UF-2** a Run consumes unbounded money or time · **UF-3** the
system reports success it cannot prove · **UF-4** source or a secret leaves the authorised perimeter ·
**UF-5** a Run cannot be explained afterwards.

None was weakened by the vision change. Each acquired a new surface: UF-1 and UF-4 now separate tenants
from each other, UF-2 now has to bound a campaign and a reactive trigger, UF-3 now has to fence a lane
with no oracle, and UF-5 now has three event logs.

A change that weakens any of these is rejected regardless of what else it achieves.

## Non-negotiable rules

### Isolation (UF-1, UF-4)

- **Never add a fallback for a missing isolation runtime.** If it is unavailable, the system refuses
  to execute. A silent downgrade makes the product's central claim false while every test still passes.
- **Never put a credential, token or API key inside a Sandbox.** Not short-lived ones either
  ([ADR-0015](docs/03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)).
- **Never give a Sandbox network access during verification**
  ([ADR-0006](docs/03-adr/0006-no-network-in-verification-sandbox.md)).
- **Never bind-mount a host path into a Sandbox.**
- **`exec` takes an argv vector, never a command string.** A string interface invites interpolation.
- **Never add a capability to make something work.** That is an ADR, not a configuration change.
- **The advisory lane gets the same boundary.** Producing evidence means executing something, so an
  evidence workspace is a Sandbox with every rule above. There is no lighter mode for advisory work.

### Tenancy (UF-4)

- **Never write a tenant-scoped query without its tenant predicate.** The query works. It returns rows.
  It returns someone else's. This is the one defect class whose symptom is success
  ([FR-140](docs/01-product/03-functional-requirements.md),
  [NFR-029](docs/01-product/04-non-functional-requirements.md)).
- **Never take the tenant from a request** — not a header, not a path, not a body field. It comes from
  the authenticated principal.
- **Never add a nullable tenant column.** That was correctly rejected once
  ([ADR-0013](docs/03-adr/0013-single-tenant-self-hosted-v1.md)) and the rejection is why the column is
  `NOT NULL` today. It goes in every unique constraint and every index, with row-level security.
- **Never branch on the deployment mode** outside `made/config/`. A capability that exists hosted and
  not self-hosted breaks the single-artifact claim
  ([ADR-0021](docs/03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).

### Repository access (UF-4)

- **Never accept a human's personal access token** as a repository credential. The system authenticates
  as its own scoped installation ([ADR-0027](docs/03-adr/0027-scoped-application-identity-branches-only.md)).
- **Never widen the permission envelope.** No default-branch push, no force-push, no branch deletion, no
  tags or releases, no settings or protection changes, no CI secrets, no merge, no auto-merge, no
  approving review. Each prohibition has a test.
- **Never retry an authorisation failure.** A missing permission is a statement about authority, not
  availability. It parks, with no fallback credential, no alternative ref and no degraded delivery.
- **Never post anything to a chat platform outside the allowlist.** Source, patch content, verification
  output, repository paths, file names and finding bodies are forbidden
  ([FR-114](docs/01-product/03-functional-requirements.md)).

### Termination and cost (UF-2)

- **Routing predicates, guards and the campaign progress oracle are pure.** No IO, no `datetime.now()`,
  no randomness ([ADR-0002](docs/03-adr/0002-langgraph-as-executor-with-pure-routing.md)). The vision
  change added four more time-bearing mechanisms — schedules, queue ages, worksite cycles, clarification
  TTLs — and every one is a place to make this mistake. Time enters as an event.
- **Never raise a cap, ceiling or timeout to make something finish.** This now includes a worksite's four
  ceilings, which may not be raised while it is active
  ([FR-097](docs/01-product/03-functional-requirements.md)).
- **Every model call passes admission control before it is made**, at all four levels — deployment,
  tenant, project, worksite ([07-cost-control.md](docs/02-architecture/07-cost-control.md)).
- **Every effect carries an idempotency key.** A crash must not produce a second charge. Every inbound
  trigger is idempotent on the provider's delivery identifier.
- **No self-loops.** No failure handler routes back to itself; every failure path ends in `AWAIT_HUMAN`
  or a terminal State. The one loop in any lifecycle — a request's clarification — is bounded by a
  counter in a row, not by hope.
- **Never queue anything invisibly.** Internally generated work may queue; every item carries its
  position, age, reason and cause, and every queue is bounded
  ([FR-117](docs/01-product/03-functional-requirements.md)). The test: can an operator answer "why has
  nothing happened for two hours" from the interface?
- **Never backfill a missed schedule window.** It is a recorded skip.

### Truthfulness (UF-3)

- **The verification exit code is the only definition of Task success.** No model output, no heuristic,
  no override ([ADR-0014](docs/03-adr/0014-verification-oracle-is-authoritative.md)).
- **Never make verification more forgiving to get a Run to pass.** This will be tempting, because a
  failing Run looks like your bug.
- **Never fuzzy-match a patch so it applies.** Silent corruption is worse than a rejection
  ([ADR-0008](docs/03-adr/0008-search-replace-patch-format.md)).
- **Report in three words:** *verified*, *failed verification*, *not verified*. **Those words are
  reserved for the verified lane.** Unknown values render as "unknown", never as zero. A parked Run is
  "waiting for approval", never a spinner.
- **Never let advisory output cross the boundary.** It cannot be described in the three words above,
  cannot mark a Task successful, cannot release an approval, cannot count as human acceptance, and
  cannot be blended into a figure with verified output
  ([ADR-0022](docs/03-adr/0022-two-lanes-verified-and-advisory.md)).
- **Every finding carries evidence or the word *unverified*.** Never both absent, and never suppress a
  concern to avoid the label — a reviewer reading only demonstrable findings reasonably concludes
  nothing else was found ([ADR-0023](docs/03-adr/0023-advisory-findings-carry-evidence.md)).
- **An evidence record is not a verification result.** Distinct table, distinct event kind, and it
  satisfies no invariant that a verification satisfies. *Demonstrated* is a claim about a command;
  *verified* is a claim about a Task.
- **Never count delivered pull requests as worksite progress.** They are work in flight. Progress is
  what the progress command measured on the default branch
  ([FR-096](docs/01-product/03-functional-requirements.md)).
- **Never show a percentage without its count**, and never render 0% where the honest answer is
  "insufficient data" ([FR-139](docs/01-product/03-functional-requirements.md)).

### Auditability (UF-5)

- **Every effect that spends money or executes code writes its event in the same transaction.** If it
  cannot be logged, it does not happen. This includes an inbound trigger: one that cannot be recorded is
  not acted on.
- **Never read a framework checkpoint on an audit, export or reporting path**
  ([ADR-0004](docs/03-adr/0004-event-log-separate-from-checkpoints.md)).
- **Event evolution is additive only**, across all three event logs. Removing a field or changing a
  kind's meaning breaks historical folds.
- **Never build a rollup table for an effectiveness figure.** Every one is computed from the event log by
  a published query. A second source of truth for the product's own value claim is a trust failure
  ([FR-131](docs/01-product/03-functional-requirements.md)).

### Scope

- **Never build anything on a "do not build" list**
  ([future-phase seams](docs/02-architecture/15-future-phase-seams.md)): parallel **Task** execution
  inside a Run, a vector index, generic webhooks, cross-Run agent memory, model-authored image builds,
  greenfield scaffolding, generated planning.
- **Two entries on that list changed in 2026-09 and are easy to get wrong.** *Multi-tenancy is now
  required* — Seam 2 is closed, and a tenant column is mandatory rather than forbidden. *Chat egress
  exists* — but it is one named adapter with a fixed payload allowlist, and the general webhook
  prohibition stands. A configurable destination or payload **breaks** that prohibition rather than
  qualifying it.
- **The Architect, `SPEC`, `PLAN` and generated planning are specified and deferred**
  ([ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). A work class supplies
  the plan, so a Run reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`. **The chat front
  door does not change this**: it brokers a message onto a declared class or declines it with a reason.
  Whether generated planning returns is **OQ-19**, the largest open question in the specification.
- **Never accept work with no runnable oracle in the verified lane.** "Improve quality", "modernise this
  module", "make it faster" are judgement calls dressed as tasks. **In the advisory lane they are still
  refused as tasks** — permitted only as findings that carry evidence or say they do not.
- **Never promote advisory output into the verified lane.** An advisory Run emits a finding; it does not
  start a Run to fix it. There is no edge from the advisory sub-graph into `IMPLEMENT`.
- **Never add a role that is a prompt variant.** A candidate sharing its lane, States, tool authority,
  tier and artifact kinds with an existing role is a prompt
  ([16-agent-role-model.md](docs/02-architecture/16-agent-role-model.md)). The word "swarm" invites this
  mistake.
- **Never add a fifth long-running process kind** without a superseding ADR
  ([NFR-021](docs/01-product/04-non-functional-requirements.md)). Replicating an existing kind is not a
  fifth; a scheduler, gateway or notification service would be.

## Vocabulary

Use the terms in [the glossary](docs/00-context/03-glossary.md) exactly, in code, database columns, API
fields, event kinds, log fields and user-facing text. `run` not `job`. `sandbox` not `container`.
`verification` not `test run`. `attempt` not `iteration`. `patch` not `diff`. `worksite` not `campaign`.
`lane` not `mode`. `finding` not `comment`. `evidence` not `proof`. `tenant` not `organisation`. The
banned-synonym table is enforced by `spec-lint`, and the reason is practical: an agent debugging a
failure must be able to see that a log line, a database row and an API response describe the same thing
without inferring it.

One ban was **lifted** and the reason is recorded in place: `user` is now a first-class entity, because
an approval policy cannot express who may approve what against an actor string. `user`, `operator` and
`principal` are three named concepts; `customer` remains banned in favour of `tenant`.

## Changing a decision

Do not argue with an accepted ADR in a pull request. Write a superseding one
([rules](docs/03-adr/README.md)), have it accepted, then implement against it. Present the option you
are overturning at its strongest, and record what your new decision costs. An ADR with no negative
consequences is not a decision, it is a preference.

The 2026-09 ADRs are the worked example: ADR-0021 supersedes ADR-0013 and **accepts every cost it
named** rather than disputing them, and ADR-0028 supersedes ADR-0016 while retaining both its display
rules and its technology choice.

## Roles and boundaries

Roles map to directories. Stay inside yours; if the work needs another, that is a separate backlog item.

| Role | Owns | Must not touch |
| --- | --- | --- |
| `platform` | `made/api/`, `made/store/`, `made/config/`, `made/artifacts/`, `made/effectiveness/`, `made/chat/`, `made/git/`, `made/cli/`, `migrations/` | `made/orchestrator/routing.py`, `made/worksites/oracle.py`, `made/sandbox/`, prompts |
| `orchestration` | `made/orchestrator/`, `made/worksites/`, `made/requests/`, `made/workclasses/`, `made/agents/`, `made/context/` | `made/sandbox/`, `made/store/` internals, `contracts/` |
| `sandbox` | `made/sandbox/`, `made/tools/`, `deploy/images/`, `tests/escape/` | `made/agents/`, `made/llm/` |
| `llm` | `made/llm/`, `made/agents/prompts/`, `made/eval/` | `made/orchestrator/routing.py`, `made/sandbox/` |
| `infra` | `deploy/`, `.github/`, `Makefile`, `made/observability/` | Anything under `made/` other than observability |
| `spec` | `docs/`, `contracts/`, `tools/spec_lint/` | All application code |

Five rules cut across every role, each protecting a documented seam. Only `made/sandbox/` may know which
isolation runtime is in use. Only `made/llm/providers/` may name a model vendor. Only `made/chat/` may
name a chat platform or hold the posting allowlist. Only `made/config/` may read the deployment mode.
And only `made/store/` may execute SQL, which is what makes the tenant predicate auditable in one place.

## Git and pull requests

Branch `<item-id>-<short-slug>`. Conventional commit subject, imperative, with a `Refs:` footer naming
the backlog item and the requirement ids. Squash merge. Full conventions, the pull-request template and
the blocking review checklist are in
[04-engineering/05-git-and-review-workflow.md](docs/04-engineering/05-git-and-review-workflow.md).

**Before starting**, check the **Touches** of every in-flight backlog item. If yours overlaps, stop and
take a different item. Two agents editing one file is not a merge problem — it is two agents having been
told different things.

**Contract changes land alone and first.** A pull request touching `/contracts/` contains only that
change plus its schema tests. That is what lets several agents implement consumers in parallel, and it
is currently a hard gate on everything the vision change added.

## Open questions

An `OQ-##` block marks something genuinely undecided. **Do not invent an answer.** Follow the constraint
the block states, or stop and report. All of them are collected with what they block in
[the backlog](docs/05-delivery/02-backlog.md#open-questions).

**There are more of them than before the vision change, not fewer.** That is the correct state for a
product whose scope widened recently, and a specification that read as though everything were decided
would be the dishonest version. Five can only be answered by the founder — OQ-01, OQ-11, OQ-12, OQ-15,
OQ-16 — and two are answered by measurements the system itself produces, which is why the instrument
exists before the answer does.

## Do not fabricate

Do not invent statistics, prices, benchmark figures, regulations, standards, market sizes or institution
names. The unverified claims carried from the project intake are recorded and marked in
[00-context/02-ecosystem-and-stakeholders.md](docs/00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified),
and no decision here depends on one being true. If you need a fact and do not have it, raise it as an
open question. A confident invented number propagates into decisions that look justified.

**This extends to our own numbers.** Where the vision change created a measure with no basis — the share
of advisory findings that can carry evidence, an acceptable advisory acceptance rate, the worksite cycle
count — the requirement states the measurement method and the value is `TBD` with a **report only**
failure action. That suspends this repository's usual practice of enforcing a provisional gate, and the
reason is that these are numbers a buyer would be shown: an invented one here would be
indistinguishable from a measured one three documents later. **Closing such a milestone by choosing a
value is a failure, not a shortcut.**

## When you are stuck

**Stop after two failed attempts at the same approach.** Report:

1. What you tried, both attempts, concretely.
2. The evidence — the actual error or failing assertion, not your interpretation of it.
3. Your suspected root cause.
4. Two plausible next steps.

**Never** weaken a test, loosen an assertion, add a tolerance, skip a case, raise a cap, relax the
`unverified` label, blend two lanes into one number, or silently reduce scope. A blocked item reported
honestly is worth more than a green pull request that quietly does less than it claims — which is
exactly the failure this product exists to eliminate, so producing it here would be self-defeating.

## Where to go next

Picking up work: [docs/05-delivery/02-backlog.md](docs/05-delivery/02-backlog.md), then your item's
**Reading** list, then [the agent playbook](docs/05-delivery/03-agent-playbook.md).
Finishing work: [the definition of done](docs/05-delivery/04-definition-of-done.md).
Wondering why something changed: [the 2026-09 vision change](docs/00-context/06-vision-change-2026-09.md).
Everything else: [docs/README.md](docs/README.md).
