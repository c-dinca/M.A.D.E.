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

## Auditability — gate (UF-5)

- [ ] Every new effect that spends money or executes code writes its event in the same transaction.
- [ ] Folding the event log still reproduces State and spend for the replay corpus.
- [ ] New event kinds are additive: no existing kind changed meaning and no field was removed.
- [ ] Nothing reads a framework checkpoint on an audit, export or reporting path.

## Contracts and vocabulary

- [ ] `make spec-lint` passes.
- [ ] If a contract changed, this pull request contains only that change plus its schema tests.
- [ ] Prose and contracts agree; where they disagreed, the prose was fixed.
- [ ] No banned synonym in an identifier, column, API field, event kind or log field.
- [ ] Any new `OQ-##` is marked inline *and* added to the open-questions table in
      [02-backlog.md](02-backlog.md#open-questions).

## Security and data handling

- [ ] No secret, customer data, or generated artifact committed.
- [ ] Any new secret is registered with the redactor at startup.
- [ ] No new outbound network path from the control plane.
- [ ] No new endpoint returns secret material or executes anything on demand.
- [ ] New log lines carry `run_id` and contain no prompt bodies, completions or credential-shaped
      values.

## Operability

- [ ] Process count unchanged, or an ADR justifies the increase
      ([NFR-021](../01-product/04-non-functional-requirements.md)).
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
`make escape` pass and a clean nightly invariant run.
