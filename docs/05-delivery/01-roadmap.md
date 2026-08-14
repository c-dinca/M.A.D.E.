# Roadmap

Milestones are defined by capability and gated by exit criteria, not by dates. The sequence is a
dependency argument: each milestone removes the risk that would invalidate the next one's work.

> **Resequenced by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).** The
> product is maintenance work on existing repositories, so the plan comes from a work class rather than
> from the Architect ([01-product/05-work-classes.md](../01-product/05-work-classes.md)). The
> consequence is large and worth stating before the milestones: **M4 is no longer on the critical path
> to the first sellable capability.** The multi-agent orchestration, the Architect, `SPEC`, `PLAN` and
> plan approval move behind first revenue. What replaces M4 in the critical path is a smaller
> milestone — M3b, the first work class — because a fixed task template plus the repository's own test
> suite is a complete product, and generated planning is not needed to sell it.
>
> Everything in M0 through M3 is unchanged. It was strategy-independent, which is why it was sequenced
> first.

## Sequencing rationale

**Isolation before agents (M1 before M3).** The isolation boundary is the highest-risk unknown and the
one whose failure invalidates everything built on it. Discovering at M4 that the runtime cannot be
installed on the target platform (OQ-08), or that Sandbox creation is too slow to be usable, would
waste every milestone above it. It is also the property the buyer's veto turns on
([00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md)).

**Deterministic core before models (M2 before M3).** Tools, patch application, normalisation and the
guards are all testable without a model, and they are what the model's output flows through. Building
them first means that when the first agent runs, a failure is attributable to the prompt rather than
to an ambiguity about which layer is wrong.

**Guards with the first model call, not after (M3).** Cost controls retrofitted onto a working agent
are always incomplete, because the code was not written to ask permission. This is the specific
mistake that produces the overnight-budget incident, and it is cheap to avoid only if done first.

**One agent before five (M3 before M4).** Multi-agent coordination adds failure modes on top of
single-agent failure modes. Debug them separately.

**Evaluation before optimisation (M5 before any prompt tuning).** Without a baseline, every prompt
change is anecdote and every "cheaper model" change silently raises total cost by adding attempts
([NFR-027](../01-product/04-non-functional-requirements.md)).

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

## M3b — The first work class, and delivery

*Capability: a scheduled `dependency_upgrade` produces a merged pull request with no human edit. This
is the first sellable capability and it replaces M4 on the critical path.*

Work-class registry with fixed task templates; the `dependency_upgrade` class including the manifest and
lockfile consistency rule; the scheduler inside the existing worker; durable `AWAIT_HUMAN` with recorded
approvals; git delivery through the control plane; commit trailers. No Architect, no `SPEC`, no `PLAN`,
no plan approval.

**Exit criteria**

- A scheduled Run bumps a dependency, fixes what the bump breaks, and passes the repository's own suite
  in a Sandbox.
- A patch modifying a manifest without a consistent lockfile update is rejected
  ([FR-083](../01-product/03-functional-requirements.md)).
- No push to a default branch is possible, and no push occurs without a recorded approval.
- A Run created from a work class reaches `IMPLEMENT` with zero model calls in `SPEC` or `PLAN`
  ([FR-081](../01-product/03-functional-requirements.md)).
- Scheduled Runs respect the concurrency cap and every budget ceiling — the case those guards exist for
  ([FR-082](../01-product/03-functional-requirements.md)).
- **The metric exists and is reported: share of pull requests merged with no human edit.** This is the
  number the economic buyer buys, and OQ-09 must be resolved for any of it to run.

## M4 — Multi-agent and generated planning (deferred behind first revenue)

*No longer on the critical path. Retained as specification; build only when work classes stop covering
demand ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 4).*

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

The golden suite across all five tiers with three repetitions; committed baselines and the comparison
gate; the adversarial repositories; nightly invariant queries and audit reconciliation; backup and
restore drill; the bootstrap timing job; the operator runbook.

**Exit criteria**

- The harness runs unattended nightly with results committed.
- A prompt or tier change can be evaluated before merge, and CI blocks a regression beyond
  [NFR-027](../01-product/04-non-functional-requirements.md).
- Zero authority violations across the adversarial tier
  ([NFR-028](../01-product/04-non-functional-requirements.md)).
- Restore drill reproduces a deployment on a clean host with a byte-identical audit export for a
  sampled Run.
- Bootstrap on a clean VM completes within
  [NFR-020](../01-product/04-non-functional-requirements.md).
- **Merge-rate without human edit measured on the `dependency_upgrade` class** — the number that decides
  whether M6 happens at all, and the one the economic buyer is actually buying. It replaces trivial-tier
  pass rate as the gating measurement, because it is the same question asked in the buyer's terms.

## M6 — Design-partner install

*Capability: someone else's repository, on someone else's hardware.*

Not started until M5's measured pass rate clears
[NFR-026](../01-product/04-non-functional-requirements.md), because installing below it means asking a
customer to supervise rather than to delegate.

**Exit criteria**

- An external design partner runs the flow on their own private repository, on their own host, from
  prose to reviewable pull request, without operator intervention.
- Their security reviewer can answer "what did it execute and what could it reach" from the audit
  export alone.
- OQ-01, OQ-02, OQ-05 and OQ-06 resolved by contact with a real customer.

## Kill and pivot criteria

Decided now, while it is still cheap to be honest.

**Merge rate.** If fewer than 70% of `dependency_upgrade` pull requests merge without a human editing
the diff, the product is a suggestion engine with extra steps. Note that
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) has already taken the pivot
this criterion used to prescribe — narrowing to a task class with a strong oracle — so the next
narrowing is *within* the class: patch and minor upgrades only, no breaking changes. Narrow, do not
broaden.

**Unit economics.** If cost per successful outcome exceeds roughly a quarter of what the buyer would
plausibly pay, there is no room for support or for a model price rise. Attack context and caching
first ([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)); if that fails,
narrow the scope.

**Escalation rate.** If more than 40% of Runs need a human to make progress, the product is supervision
rather than automation. Either reposition honestly as a supervised assistant, or narrow the task class.

**Isolation.** Any escape-suite failure that cannot be closed within the chosen boundary stops
everything until it is closed or the boundary is replaced. This is the one criterion with no trade-off
available.
