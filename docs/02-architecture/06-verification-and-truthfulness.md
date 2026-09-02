# Verification and truthfulness

The mechanism for [UF-3](01-system-overview.md#the-five-unforgivable-failures). This document is the
one an agent is most likely to violate while trying to be helpful, because every weakening here makes
a run more likely to "succeed".

The rule, stated once:

> **A Task is successful when a declared command, executed in a Sandbox, exits zero. Nothing else
> makes a Task successful. No model output, no heuristic, no operator override.**

> **The rule is unchanged by the 2026-09 vision change, and its *scope* is now explicit.** It governs
> the **verified lane**. A second lane exists with no oracle at all
> ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md),
> [01-product/06-lanes.md](../01-product/06-lanes.md)), and the mechanism protecting UF-3 there is not a
> weaker version of this rule — it is a fence, specified in the section on the lane boundary below.
>
> Stating the scope is itself a risk, and it is worth naming: "nothing is successful unless a command
> exits zero" was the whole claim, and a qualifier in a trust claim is expensive
> ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md), negative consequences). The
> alternative — leaving the scope implied while shipping work the rule does not cover — is the version
> that actually breaks UF-3.

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

Added by the vision change, each for the same reason — a claim presented more strongly than what was
established ([FR-087](../01-product/03-functional-requirements.md),
[FR-089](../01-product/03-functional-requirements.md),
[FR-132](../01-product/03-functional-requirements.md),
[FR-139](../01-product/03-functional-requirements.md)):

- Rendering an advisory finding in the formatting used for a verified result, or describing an advisory
  Run with any of the three words above.
- Rendering an `unverified` finding the way a `demonstrated` one is rendered, or omitting a concern in
  order to avoid the `unverified` label ([FR-149](../01-product/03-functional-requirements.md)).
  Suppression is a truthfulness failure by omission, not a tidiness improvement.
- Presenting an evidence record as a verification result, or counting one in a verified acceptance
  rate.
- Reporting a worksite's delivered-but-unmerged pull requests as progress
  ([FR-096](../01-product/03-functional-requirements.md)). Work in flight is review debt the system
  created, not outcome it produced.
- Displaying a percentage without the count it was computed from, or displaying 0% where the honest
  answer is "insufficient data".
- Publishing a completion estimate for a worksite without the number of observations behind it.
- Blending a figure across lanes ([FR-094](../01-product/03-functional-requirements.md)).
- Reporting a request as answered when the chat post failed, or a Run as delivered when the push
  failed. Same rule, two surfaces.
- Showing waiting work as nothing at all. A queued item renders its position, age and cause
  ([FR-117](../01-product/03-functional-requirements.md)).

## The lane boundary

The advisory lane has no oracle, so nothing in it can be verified. What protects UF-3 there is a set of
fences, each with a test, and the failure they exist to prevent is one sentence: **advisory output
borrowing the credibility of verified output.**

**The vocabulary is reserved.** *Verified*, *failed verification* and *not verified* describe a
verification result and nothing else. An advisory Run reports its findings, their evidence state, its
cost and its terminal reason ([FR-086](../01-product/03-functional-requirements.md)).

**One word is shared deliberately.** A Run whose verification did not run is *not verified*; a finding
with no evidence is *unverified*. The reader's conclusion is identical — nobody checked — and using a
softer word for the advisory case would be the credibility transfer itself.

**Evidence is not verification.** An evidence record is produced by the same executor and normalised by
the same normaliser, and it is deliberately a **distinct table with a distinct event kind**
([02-data-model.md](02-data-model.md), INV-12). It does not satisfy INV-2, cannot mark a Task
successful, and cannot appear in a verified acceptance rate
([FR-092](../01-product/03-functional-requirements.md)).

**Evidence proves the demonstration, not the judgement.** A failing test proves that a test fails.
Whether the failure matters, whether the behaviour is a bug or a deliberate edge case, and whether
anything should change are human calls. `demonstrated` is a claim about a command; *verified* is a claim
about a Task. They are not the same claim, and this is the sentence to hold onto when someone proposes
describing a demonstrated finding as verified.

**A demonstrated finding can still be wrong, and will look more right than it is.** The reader's trust
in the exit code may transfer to the judgement wrapped around it. That is a genuine new failure mode
created by the evidence requirement rather than solved by it
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md), negative consequences), and the
mitigation is presentation — a demonstrated finding leads with its command and exit code, so the reader
sees what was actually established.

**Nothing may be blended.** A single acceptance rate across both lanes is forbidden
([FR-094](../01-product/03-functional-requirements.md)), for the same reason cost per successful Run and
cost per failed Run are reported separately: the average of two numbers that mean different things
hides the one that matters, and it hides it in our favour.

## Why the Reviewer exists at all, given it cannot decide

The Reviewer catches what an exit code cannot: a change that passes its test while doing something
undesirable — deleting an unrelated branch of logic, hard-coding a value that should be a parameter,
copying a secret into a log line. That is real value, and it is why the role exists.

It is advisory because an LLM judging an LLM produces correlated errors. If the Reviewer could mark a
Task successful, the system would have a path to success with no execution in it, and UF-3 would
depend on model quality. So the Reviewer may route work back or escalate to a human; it may never mark
success ([FR-042](../01-product/03-functional-requirements.md)). Its findings are attached to the
branch for the human reviewer, which is where a judgement call belongs.

**The vision change made the Reviewer the only role that spans lanes**, and gave the advisory half
something the verified half does not have: an obligation to produce evidence
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). That is worth noticing, because it
partly answers the correlated-errors objection above. A model judging a model is weak evidence; a model
that writes a test which then fails against a real tree has produced something a second model's opinion
cannot manufacture. The judgement is still advisory. The demonstration is not.

In `REVIEW` the Reviewer cannot write at all. In `ASSESS` it can write and execute, scoped to the
evidence workspace by the State's grant
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)). The same role, different
authority, decided by the State — which is the clearest illustration in the system of why authority is a
property of the State rather than of the role
([16-agent-role-model.md](16-agent-role-model.md)).

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
| Reserved vocabulary per lane | An advisory Run described as verified | [FR-086](../01-product/03-functional-requirements.md), [FR-087](../01-product/03-functional-requirements.md); console tests ([NFR-037](../01-product/04-non-functional-requirements.md)) |
| `evidence_state` as a two-valued check constraint with a foreign key | A finding claiming a demonstration that has no record | INV-11, database-level |
| Distinct table and event kind for evidence | An evidence record counted as a verification | INV-12, INV-13; nightly query |
| No `confidence` column, no third lane | A model's opinion becoming a number that gets averaged | Schema; [ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md) |
| No edge from the advisory sub-graph to `IMPLEMENT` | An agent promoting its own output across the lane boundary | State-machine contract; routing test |
| Progress measured by a command on the default branch | Activity reported as outcome | [FR-096](../01-product/03-functional-requirements.md); worksite fold ([NFR-041](../01-product/04-non-functional-requirements.md)) |
| No effectiveness rollup table | A stale flattering figure with no referent | [FR-131](../01-product/03-functional-requirements.md); published queries |
| Denominator required on every measure | A 100% acceptance rate over two pull requests | [FR-139](../01-product/03-functional-requirements.md); console test |
