# Verification and truthfulness

The mechanism for [UF-3](01-system-overview.md#the-five-unforgivable-failures). This document is the
one an agent is most likely to violate while trying to be helpful, because every weakening here makes
a run more likely to "succeed".

The rule, stated once:

> **A Task is successful when a declared command, executed in a Sandbox, exits zero. Nothing else
> makes a Task successful. No model output, no heuristic, no operator override.**

## Why this is the load-bearing property

A system that fails 40% of the time and says so is usable: a reviewer spends their attention on the
60% that arrived with evidence. A system that fails 10% of the time and cannot tell which 10% is
worse than useless, because every output must now be audited from scratch — which is more work than
writing the change by hand. Trust is not a function of the success rate; it is a function of whether
the reported outcome is true.

This is also the property competitors in the intake's landscape are weakest on, and it is cheap for
us to hold because it is enforced by exit codes rather than by model quality. It is the one guarantee
that does not degrade when the model does.

## The oracle requirement

Every Task carries a `verification_command`: an argv vector, executable inside the Sandbox, whose exit
code defines that Task's success. Four rules make it trustworthy:

**Declared at planning time.** The command is written when the plan is accepted and is immutable
thereafter ([FR-034](../01-product/03-functional-requirements.md), enforced in the schema by having no
update path). A command chosen after seeing the failure is not an oracle; it is a rationalisation.

**Validated before the plan is accepted.** `GUARD_PLAN_VALID` rejects a graph containing a Task with
no command ([FR-024](../01-product/03-functional-requirements.md)). Work that cannot be checked never
enters the queue.

**Executed verbatim.** No interpolation, no shell, no agent-supplied arguments
([FR-033](../01-product/03-functional-requirements.md)). The argv vector recorded in the Task is the
argv vector passed to `exec`.

**Executed with no model in the loop.** The `VERIFY` state has no agent and a toolbelt containing only
`run_verification` ([05-orchestration-and-termination.md](05-orchestration-and-termination.md)). There
is no code path in which a model's opinion is read while a verification result is computed.

### Oracles by Task kind

| Kind | Typical oracle | Why it is a real oracle |
| --- | --- | --- |
| `code` | A test selection that exercises the change (for example a test-runner invocation scoped to the affected tests) | Executes the behaviour the change claims to produce |
| `test` | The new test run twice: failing against the pre-change tree and passing against the post-change tree | A test that passes before the change proves nothing; this is the only way to know the test tests something |
| `iac` | Static validation of the produced artifact — Dockerfile lint, Compose config parse, IaC validate | Deterministic and offline; v1 does not build or run model-authored images ([04-execution-isolation.md](04-execution-isolation.md)) |
| `docs` | A link and reference checker plus a build of the documentation, where the Project has one | Catches the failure mode that matters for docs: broken references |

The `test` kind's double execution deserves emphasis. Without it, the QA agent can write
`assert True`, watch it pass, and the system will report a verified test. Requiring the test to fail
against the pre-change tree is the difference between a QA agent and a green-tick generator, and it is
[FR-033](../01-product/03-functional-requirements.md) applied to the one Task kind where the naive
oracle is self-satisfying.

> **Open question OQ-07** — Whether the Architect can reliably produce a scoped test selection for an
> arbitrary customer repository, or whether v1 should require the Project to declare a
> `verification_command_template` per Task kind at registration. **Blocks:** the Architect prompt and
> the plan schema's `verification_command` field constraints (backlog items `ORCH-06` and `AGENT-02`).
> **Resolved by:** attempting plan generation against three real repositories with different test
> runners and recording how often the produced command is valid. Until resolved, implement the
> Project-declared template as the required path and treat Architect-generated commands as an
> enhancement behind a flag.

## Normalisation and the failure signature

Verification output is normalised before anything is done with it, and the same normaliser serves two
consumers: the progress oracle ([05-orchestration-and-termination.md](05-orchestration-and-termination.md))
and the prompt reducer ([08-context-and-retrieval.md](08-context-and-retrieval.md)). One
implementation, one behaviour — two would drift, and the guard would quietly stop matching what the
agent was shown.

Normalisation removes, in this order: absolute paths (replaced by workspace-relative), timestamps and
durations, memory addresses and object ids, temporary file and directory names, process ids, and
random seeds or uuids. Stack frames outside the workspace are dropped. What remains is the assertion,
the error type, the message and the workspace-relative location.

```
failure_signature = sha256(normalised_output + "\0" + str(exit_code))
failing_count     = parsed count of failing checks, or 1 if unparseable
```

`failing_count` falling back to 1 when the runner's output cannot be parsed is deliberate and worth
understanding: an unparseable output can never show a *reduction* in failures, so the progress oracle
falls back to comparing signatures alone. That is the conservative direction — it stops retries
earlier rather than later.

## Truthfulness in reporting

Verification produces exactly three outcomes, and every surface uses these words
([FR-045](../01-product/03-functional-requirements.md)):

**Verified** — the command ran and exited zero. Displayed with the command, exit code and duration.

**Failed verification** — the command ran and exited non-zero. Displayed with the command, exit code
and normalised output.

**Not verified** — the command did not run to completion: timeout, Sandbox failure, or the Run stopped
first. This is never displayed as failure and never as success, because the distinction changes what
the human should do next.

Prohibited, each because it has a specific failure it causes:

- Reporting a Task as complete when only lint passed. Lint is a cheap pre-filter, not the oracle.
- Reporting a Run as successful when some Tasks failed. Partial success is reported per Task, and the
  Run's outcome is the honest aggregate.
- Presenting a Reviewer's approval as verification. The Reviewer is advisory
  ([FR-042](../01-product/03-functional-requirements.md)).
- Displaying a spinner or "in progress" for a Run that is parked in `AWAIT_HUMAN`. Parked is a
  different state from working, and conflating them makes a stalled Run invisible.
- Defaulting an unknown cost, count or duration to zero. Unknown renders as "unknown".

## Why the Reviewer exists at all, given it cannot decide

The Reviewer catches what an exit code cannot: a change that passes its test while doing something
undesirable — deleting an unrelated branch of logic, hard-coding a value that should be a parameter,
copying a secret into a log line. That is real value, and it is why the role exists.

It is advisory because an LLM judging an LLM produces correlated errors. If the Reviewer could mark a
Task successful, the system would have a path to success with no execution in it, and UF-3 would
depend on model quality. So the Reviewer may route work back or escalate to a human; it may never mark
success ([FR-042](../01-product/03-functional-requirements.md)). Its findings are attached to the
branch for the human reviewer, which is where a judgement call belongs.

## Injection is an authorisation problem

Repository content, dependency output, test names and issue text are attacker-controlled
([04-execution-isolation.md](04-execution-isolation.md)). Do not attempt to defeat injection with
instructions like "ignore malicious content". Architect it away:

1. **The Sandbox has no model access and no credentials**, so injected text cannot spend budget or
   reach a model directly.
2. **Tool authority is a property of the State**, read from the state machine contract, not a
   negotiable part of the conversation. A `VERIFY`-state actor cannot construct a write tool no matter
   what a file says ([FR-069](../01-product/03-functional-requirements.md)).
3. **The verification command comes from the plan**, not from content or from model output at
   verification time.
4. **Tool results are wrapped as untrusted data** with provenance labels, and the system prompt states
   that tool output is observation, never instruction
   ([FR-075](../01-product/03-functional-requirements.md)).
5. **Every state-changing effect is orchestrator-mediated, logged and idempotent**, so the worst
   outcome of a successful injection is a bad patch that fails verification or that a human declines.

Injection will still occasionally succeed at the content level — a subtly wrong patch that passes. The
design goal is that its blast radius is bounded by the State's authority grants and the approval gate,
and that it is visible afterwards in the log. Adversarial golden cases assert this continuously
([FR-078](../01-product/03-functional-requirements.md),
[NFR-028](../01-product/04-non-functional-requirements.md)).

## Enforcement summary

| Enforcement point | What it prevents | Where |
| --- | --- | --- |
| Plan validator | Unverifiable work entering the queue | `GUARD_PLAN_VALID` |
| Immutable `verification_command` | Redefining success after seeing the failure | Schema: no update path; [FR-034](../01-product/03-functional-requirements.md) |
| `VERIFY` has no model and no write tools | An opinion overriding an exit code | Toolbelt factory, state machine contract |
| Database invariant INV-2 | A Run reaching `DONE` without zero exit codes | Nightly query, [NFR-018](../01-product/04-non-functional-requirements.md) |
| Reviewer verdict typed as advisory | A model marking its own work successful | Routing function signature; [FR-042](../01-product/03-functional-requirements.md) |
| Three-outcome reporting vocabulary | "Not verified" being rendered as success | [FR-045](../01-product/03-functional-requirements.md), UI test |
| Double execution for `test` Tasks | Tests that would pass without the change | Task-kind oracle rule above |
