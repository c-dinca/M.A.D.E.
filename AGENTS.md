# AGENTS.md — operating rules

Read this before anything else. It is short on purpose; everything it points at is longer.

## What this project is

M.A.D.E. removes maintenance and technical-debt work from an engineering team: it runs **unattended**
against existing repositories, carries out jobs in declared **work classes** — a dependency upgrade
that also fixes what the upgrade breaks, a lint-debt sweep, a mechanical API migration — and opens a
pull request for a human to merge. Every job is proved by the repository's **own** test suite, executed
in an isolated Sandbox with no credentials and no network, and nothing is called successful unless that
command exits zero. It is sold to organisations whose maintenance burden cannot be staffed economically
and whose client contracts forbid sending source to a third party, which is why unattended execution,
enforced budgets and a complete audit trail are the product rather than the scaffolding.

Read [ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md) before anything else
if you are about to write code. It defines the product boundary and it deferred a large part of what is
specified here — the Architect and generated planning among it.

## Source of truth, in order

When two things disagree, the higher one wins and the lower one is a defect to be fixed:

1. **[`/contracts/`](contracts/)** — the machine-readable contracts. Normative.
2. **Accepted ADRs** in [`docs/03-adr/`](docs/03-adr/README.md) — the settled decisions.
3. **Documents** in [`docs/`](docs/README.md) — everything else.
4. **Existing code** — which may be wrong, and is the *last* thing to trust. Code that contradicts a
   contract is a bug even if it is shipped and passing.

If a document contradicts a contract, fix the document in the same pull request. Do not implement the
document.

## The five unforgivable failures

Everything below exists to prevent one of these
([system overview](docs/02-architecture/01-system-overview.md#the-five-unforgivable-failures)):

**UF-1** code escapes the Sandbox · **UF-2** a Run consumes unbounded money or time · **UF-3** the
system reports success it cannot prove · **UF-4** source or a secret leaves the authorised perimeter ·
**UF-5** a Run cannot be explained afterwards.

A change that weakens any of these is rejected regardless of what else it achieves.

## Non-negotiable rules

### Isolation (UF-1, UF-4)

- **Never add a fallback for a missing isolation runtime.** If it is unavailable, the system refuses
  to execute. A silent downgrade makes the product's central claim false while every test still
  passes.
- **Never put a credential, token or API key inside a Sandbox.** Not short-lived ones either. The
  answer to "what if the agent is compromised" must remain "there is nothing to steal"
  ([ADR-0015](docs/03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)).
- **Never give a Sandbox network access during verification**
  ([ADR-0006](docs/03-adr/0006-no-network-in-verification-sandbox.md)).
- **Never bind-mount a host path into a Sandbox.**
- **`exec` takes an argv vector, never a command string.** A string interface invites interpolation.
- **Never add a capability to make something work.** That is an ADR, not a configuration change.

### Termination and cost (UF-2)

- **Routing predicates and guards are pure.** No IO, no `datetime.now()`, no randomness. A router that
  reads the clock decides differently on replay than it did in production, which destroys
  auditability ([ADR-0002](docs/03-adr/0002-langgraph-as-executor-with-pure-routing.md)).
- **Never raise a cap, ceiling or timeout to make something finish.** Caps are Project configuration,
  versioned and recorded.
- **Every model call passes admission control before it is made**
  ([07-cost-control.md](docs/02-architecture/07-cost-control.md)).
- **Every effect carries an idempotency key.** A crash must not produce a second charge.
- **No self-loops.** No failure handler routes back to itself; every failure path ends in
  `AWAIT_HUMAN` or a terminal State.

### Truthfulness (UF-3)

- **The verification exit code is the only definition of Task success.** No model output, no
  heuristic, no override ([ADR-0014](docs/03-adr/0014-verification-oracle-is-authoritative.md)).
- **Never make verification more forgiving to get a Run to pass.** This will be tempting, because a
  failing Run looks like your bug.
- **Never fuzzy-match a patch so it applies.** Silent corruption is worse than a rejection
  ([ADR-0008](docs/03-adr/0008-search-replace-patch-format.md)).
- **Report in three words:** *verified*, *failed verification*, *not verified*. Unknown values render
  as "unknown", never as zero. A parked Run is "waiting for approval", never a spinner.

### Auditability (UF-5)

- **Every effect that spends money or executes code writes its event in the same transaction.** If it
  cannot be logged, it does not happen.
- **Never read a framework checkpoint on an audit, export or reporting path**
  ([ADR-0004](docs/03-adr/0004-event-log-separate-from-checkpoints.md)).
- **Event evolution is additive only.** Removing a field or changing a kind's meaning breaks
  historical folds.

### Scope

- **Never build anything on a "do not build" list**
  ([future-phase seams](docs/02-architecture/15-future-phase-seams.md)): parallel Task execution, a
  tenant column, a vector index, webhooks, cross-Run memory, model-authored image builds, greenfield
  scaffolding. These are specified as seams precisely so that building them is a visible mistake
  rather than a plausible improvement.
- **The Architect, `SPEC`, `PLAN` and plan approval are specified but deferred**
  ([ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). A work class supplies
  the plan, so a Run reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`. Do not implement
  generated planning because the specification describes it; check the milestone.
- **Never accept work with no runnable oracle.** "Improve quality", "modernise this module", "make it
  faster" are judgement calls dressed as tasks. If it cannot be checked by a command, it is not a work
  class ([work classes](docs/01-product/05-work-classes.md)).
- **Never add a fifth long-running process** without a superseding ADR
  ([NFR-021](docs/01-product/04-non-functional-requirements.md)).

## Vocabulary

Use the terms in [the glossary](docs/00-context/03-glossary.md) exactly, in code, database columns,
API fields, event kinds, log fields and user-facing text. `run` not `job`. `sandbox` not `container`.
`verification` not `test run`. `attempt` not `iteration`. `patch` not `diff`. The banned-synonym table
is enforced by `spec-lint`, and the reason is practical: an agent debugging a failure must be able to
see that a log line, a database row and an API response describe the same thing without inferring it.

## Changing a decision

Do not argue with an accepted ADR in a pull request. Write a superseding one
([rules](docs/03-adr/README.md)), have it accepted, then implement against it. Present the option you
are overturning at its strongest, and record what your new decision costs. An ADR with no negative
consequences is not a decision, it is a preference.

## Roles and boundaries

Roles map to directories. Stay inside yours; if the work needs another, that is a separate backlog
item.

| Role | Owns | Must not touch |
| --- | --- | --- |
| `platform` | `made/api/`, `made/store/`, `made/config/`, `made/artifacts/`, `made/cli/`, `migrations/` | `made/orchestrator/routing.py`, `made/sandbox/`, prompts |
| `orchestration` | `made/orchestrator/`, `made/agents/`, `made/context/` | `made/sandbox/`, `made/store/` internals, `contracts/` |
| `sandbox` | `made/sandbox/`, `made/tools/`, `deploy/images/`, `tests/escape/` | `made/agents/`, `made/llm/` |
| `llm` | `made/llm/`, `made/agents/prompts/`, `made/eval/` | `made/orchestrator/routing.py`, `made/sandbox/` |
| `infra` | `deploy/`, `.github/`, `Makefile`, `made/observability/` | Anything under `made/` other than observability |
| `spec` | `docs/`, `contracts/`, `tools/spec_lint/` | All application code |

Two rules cut across every role. Only `made/sandbox/` may know which isolation runtime is in use, and
only `made/llm/providers/` may name a model vendor. Everywhere else those are abstractions, and
leaking them breaks a documented seam.

## Git and pull requests

Branch `<item-id>-<short-slug>`. Conventional commit subject, imperative, with a `Refs:` footer naming
the backlog item and the requirement ids. Squash merge. Full conventions, the pull-request template
and the blocking review checklist are in
[04-engineering/05-git-and-review-workflow.md](docs/04-engineering/05-git-and-review-workflow.md).

**Before starting**, check the **Touches** of every in-flight backlog item. If yours overlaps, stop
and take a different item. Two agents editing one file is not a merge problem — it is two agents
having been told different things.

**Contract changes land alone and first.** A pull request touching `/contracts/` contains only that
change plus its schema tests. That is what lets several agents implement consumers in parallel.

## Open questions

An `OQ-##` block marks something genuinely undecided. **Do not invent an answer.** Follow the
constraint the block states, or stop and report. All of them are collected with what they block in
[the backlog](docs/05-delivery/02-backlog.md#open-questions).

## Do not fabricate

Do not invent statistics, prices, benchmark figures, regulations, standards or institution names. The
unverified claims carried from the project intake are recorded and marked in
[00-context/02-ecosystem-and-stakeholders.md](docs/00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified),
and no decision here depends on one being true. If you need a fact and do not have it, raise it as an
open question. A confident invented number propagates into decisions that look justified.

## When you are stuck

**Stop after two failed attempts at the same approach.** Report:

1. What you tried, both attempts, concretely.
2. The evidence — the actual error or failing assertion, not your interpretation of it.
3. Your suspected root cause.
4. Two plausible next steps.

**Never** weaken a test, loosen an assertion, add a tolerance, skip a case, raise a cap, or silently
reduce scope. A blocked item reported honestly is worth more than a green pull request that quietly
does less than it claims — which is exactly the failure this product exists to eliminate, so producing
it here would be self-defeating.

## Where to go next

Picking up work: [docs/05-delivery/02-backlog.md](docs/05-delivery/02-backlog.md), then your item's
**Reading** list, then [the agent playbook](docs/05-delivery/03-agent-playbook.md).
Finishing work: [the definition of done](docs/05-delivery/04-definition-of-done.md).
Everything else: [docs/README.md](docs/README.md).
