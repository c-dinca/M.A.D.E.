# Definition of done

An item is complete when every applicable box is checked. Groups marked **gate** are non-negotiable: a
failure there blocks the merge regardless of how much of the item works, because each maps to an
unforgivable failure ([01-system-overview.md](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)).

Check this before requesting review, not after.

## Correctness

- [ ] Every requirement claimed in the pull request has a test carrying its `FR-###` or `NFR-###`
      marker, and that test fails without the change.
- [ ] Acceptance criteria from the backlog item are demonstrably met — a command someone else can run,
      not an assertion in prose.
- [ ] Edge cases named in the Reading documents are covered: empty input, absent input, malformed
      input, duplicate submission, and the failure of every dependency the change touches.
- [ ] Coverage floors for the touched modules are met
      ([04-engineering/04-testing-strategy.md](../04-engineering/04-testing-strategy.md)).
- [ ] No test was weakened, skipped, given a tolerance, or marked expected-to-fail to make the suite
      pass.

## Isolation — gate (UF-1, UF-4)

Applies whenever `made/sandbox/`, `made/tools/`, `deploy/images/` or sandbox-related configuration is
touched.

- [ ] `make escape` passes in full against the real runtime and the real pinned image.
- [ ] No new capability, mount, network path, environment variable or credential reaches a Sandbox.
- [ ] No code path falls back to a weaker runtime under any condition.
- [ ] Any path accepted from an agent is symlink-resolved and validated host-side against the workspace
      root.
- [ ] `exec` is still argv-only; no command string interface was introduced.

## Termination and cost — gate (UF-2)

Applies whenever routing, guards, the ledger, prompts or model configuration is touched.

- [ ] No cap, ceiling or timeout was raised to make something pass.
- [ ] Routing predicates and guards remain pure: no IO, no clock, no randomness.
- [ ] Every new model call passes through admission control before it is made.
- [ ] Every new effect carries an idempotency key.
- [ ] No new self-loop in the graph, and every new failure path terminates in `AWAIT_HUMAN` or a
      terminal State.
- [ ] Where prompts changed, the stable prefix is still byte-identical across two Attempts of the same
      Task.

## Truthfulness — gate (UF-3)

- [ ] No model output can influence a verification result.
- [ ] No `verification_command` became mutable after plan acceptance.
- [ ] Any new surface reporting an outcome uses *verified*, *failed verification* or *not verified*, and
      renders unknown values as "unknown" rather than zero.
- [ ] No new path allows a Task to be marked successful without a recorded zero exit code (INV-2).

### The lane boundary — gate (UF-3)

Applies whenever the advisory lane, findings, evidence, or any reporting surface is touched.

- [ ] No advisory Run is described as *verified*, *failed verification* or *not verified*
      ([FR-086](../01-product/03-functional-requirements.md)).
- [ ] Every new finding path sets an `evidence_state`, and nothing is emitted with neither evidence nor
      an `unverified` label ([FR-149](../01-product/03-functional-requirements.md)).
- [ ] No concern is suppressed to avoid the `unverified` label.
- [ ] `demonstrated` and `unverified` render differently, asserted by a test.
- [ ] No evidence record is written as a verification event, satisfies INV-2, or counts in a verified
      acceptance rate (INV-12, INV-13).
- [ ] No figure is blended across lanes, and every displayed measure carries its count
      ([FR-094](../01-product/03-functional-requirements.md),
      [FR-139](../01-product/03-functional-requirements.md)).
- [ ] No advisory code path can patch or push a reviewed branch, or submit an approving review.
- [ ] No new edge exists from the advisory sub-graph into the verified one.

### Progress and effectiveness — gate (UF-3)

Applies whenever worksites or any reported measure is touched.

- [ ] Worksite progress is measured by executing the progress command on the default branch; nothing
      sums delivered pull requests into it ([FR-096](../01-product/03-functional-requirements.md)).
- [ ] Work in flight is rendered separately and never as progress.
- [ ] No effectiveness figure is computed from a rollup, a checkpoint or a model output
      ([FR-131](../01-product/03-functional-requirements.md)).
- [ ] A measure with insufficient data renders as "insufficient data" with its count, never as 0%.
- [ ] No completion estimate or projection is shown without the observations behind it.

## Auditability — gate (UF-5)

- [ ] Every new effect that spends money or executes code writes its event in the same transaction.
- [ ] Folding **each** event log — Run, worksite, request — still reproduces state and spend for the
      replay corpus ([NFR-041](../01-product/04-non-functional-requirements.md)).
- [ ] New event kinds are additive: no existing kind changed meaning and no field was removed.
- [ ] Nothing reads a framework checkpoint on an audit, export or reporting path.
- [ ] Every new inbound trigger is recorded before it is acted on, is idempotent on the provider's
      delivery identifier, and is **not** acted on if it cannot be recorded
      ([FR-116](../01-product/03-functional-requirements.md)).
- [ ] Every new git operation writes its event with operation, ref, identity and outcome
      ([FR-128](../01-product/03-functional-requirements.md)).
- [ ] No state survives between Runs outside git, the event logs and versioned configuration rows
      ([FR-121](../01-product/03-functional-requirements.md)).

## Tenancy — gate (UF-4)

Applies whenever `made/store/`, a query, an index, an object-store path, a metric label or a log field
is touched.

- [ ] Every new tenant-scoped table has `tenant_id NOT NULL`, in **every** unique constraint and in
      every index serving a tenant-scoped query, with row-level security enabled
      ([FR-140](../01-product/03-functional-requirements.md)).
- [ ] Every new query carries its tenant predicate, and the tenant comes from the authenticated
      principal rather than from any request field
      ([FR-141](../01-product/03-functional-requirements.md)).
- [ ] No new object-store path, artifact digest lookup, metric label or log field can reach
      tenant-scoped data without a tenant in scope
      ([FR-144](../01-product/03-functional-requirements.md)).
- [ ] No capability was added in one deployment mode and not the other, and no code outside
      `made/config/` reads `deployment_mode`
      ([FR-143](../01-product/03-functional-requirements.md)).

## Repository access — gate (UF-4)

Applies whenever `made/git/` or a delivery path is touched.

- [ ] No new git operation falls outside the permission envelope, and each prohibition still has its
      test ([FR-123](../01-product/03-functional-requirements.md),
      [NFR-035](../01-product/04-non-functional-requirements.md)).
- [ ] No authorisation failure is retried, and no fallback credential, alternative ref or degraded
      delivery was introduced ([FR-125](../01-product/03-functional-requirements.md)).
- [ ] No human's personal access token can be accepted as a repository credential.

## Contracts and vocabulary

- [ ] `make spec-lint` passes.
- [ ] If a contract changed, this pull request contains only that change plus its schema tests.
- [ ] Prose and contracts agree; where they disagreed, the prose was fixed.
- [ ] **If the item concerns an entity added by the 2026-09 vision change, its `CON-` contract item has
      already merged.** Implementing against prose whose contract has not landed is starting work that
      is not ready ([02-backlog.md](02-backlog.md)).
- [ ] No banned synonym in an identifier, column, API field, event kind or log field — including the
      terms added for lanes, worksites, findings, evidence, requests and tenancy
      ([00-context/03-glossary.md](../00-context/03-glossary.md#banned-synonyms)).
- [ ] Any new `OQ-##` is marked inline *and* added to the open-questions table in
      [02-backlog.md](02-backlog.md#open-questions).
- [ ] Any requirement that stopped applying is marked **Withdrawn** with its reason and its ID retired,
      never renumbered or reused.

## Security and data handling

- [ ] No secret, customer data, or generated artifact committed.
- [ ] Any new secret is registered with the redactor at startup.
- [ ] No new outbound network path from the control plane. Chat egress is not a precedent: a
      configurable destination or payload breaks that prohibition rather than qualifying it
      ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md), Seam 6).
- [ ] Nothing new can be posted to a chat platform outside the allowlist, and the allowlist is still
      only in `made/chat/` ([FR-114](../01-product/03-functional-requirements.md),
      [NFR-036](../01-product/04-non-functional-requirements.md)).
- [ ] No new authority is inferred from an external platform's group or channel membership
      ([FR-107](../01-product/03-functional-requirements.md)).
- [ ] No new endpoint returns secret material or executes anything on demand, and the console has no
      endpoint the published API lacks ([FR-137](../01-product/03-functional-requirements.md)).
- [ ] New log lines carry `run_id` and `tenant_id` where applicable, and contain no prompt bodies,
      completions or credential-shaped values.

## Operability

- [ ] Process **kind** count unchanged, or an ADR justifies the increase
      ([NFR-021](../01-product/04-non-functional-requirements.md)). Replicating an existing kind is not
      a new kind; a scheduler, gateway or notification service would be.
- [ ] Nothing new is queued invisibly: every queued item carries position, age, reason and cause, and
      every queue is bounded ([FR-117](../01-product/03-functional-requirements.md)).
- [ ] Alert count unchanged, or a rule was removed to make room
      ([NFR-022](../01-product/04-non-functional-requirements.md)).
- [ ] Any new operator action has a Make target.
- [ ] Migrations are additive and survive the deploy window; the previous release's suite passes against
      the new schema.
- [ ] Every new failure mode has a specified degraded behaviour, and it fails visibly rather than
      silently.

## Documentation

- [ ] Documents affected by the change are updated in the same pull request. A specification that
      describes the previous behaviour is worse than none, because an agent will implement from it.
- [ ] A decision that departs from an accepted ADR has a superseding ADR, accepted before this merge.
- [ ] Module docstrings state what the module owns and what it must not do, citing the rule where one
      applies.
- [ ] The backlog item is marked complete, and any newly discovered work is a new item with Reading,
      Touches, Role, acceptance criteria and dependencies — not a note in a comment.

## Milestone-level done

An item being done does not make a milestone done. A milestone is complete only when its exit criteria
in [01-roadmap.md](01-roadmap.md) are demonstrated, and for M1 onward that always includes a full
`make escape` pass — including its cross-tenant, permission-envelope and chat-egress cases — and a clean
nightly invariant run over INV-1 to INV-18.

**Two exit criteria are about recording a number rather than achieving one**, and meeting them by
choosing a value is a failure. The evidence ratio
([NFR-030](../01-product/04-non-functional-requirements.md)), advisory acceptance rate
([NFR-031](../01-product/04-non-functional-requirements.md)) and the worksite cycle count
([NFR-040](../01-product/04-non-functional-requirements.md)) are `TBD`, and their milestones require the
baseline to be **measured and committed**. A provisional value invented to close a milestone would be
indistinguishable from a measured one afterwards, and these are numbers a buyer would be shown.
