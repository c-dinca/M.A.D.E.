# ADR-0023 — An advisory finding carries executable evidence or is marked unverified

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** [UF-3](../02-architecture.md), [ADR-0014](0014-verification-oracle-is-authoritative.md), [ADR-0022](0022-two-lanes-verified-and-advisory.md), FR-088, FR-089, FR-090, [01-product.md](../01-product.md)

## Context

[ADR-0022](0022-two-lanes-verified-and-advisory.md) admits a lane of work with no oracle. That leaves a
gap it does not itself close: what an advisory agent actually emits.

The default answer, and the answer every product in this category has given, is a comment. "This change
looks risky." "This might leak a connection." "Consider extracting this." A comment costs a reader
attention and returns nothing checkable: they must reconstruct the reasoning, decide whether the
concern is real, and do it again for the next comment. At a volume a machine can produce, that is a
tax on review rather than a reduction in it. It is also the exact failure this repository names in
prose it applies to itself — a claim presented with confidence that nobody checked.

There is a stronger output available, and it is available specifically because this system already has
the machinery for it. An agent that suspects a bug can write the test that fails. An agent that
suspects a performance regression can write the benchmark that shows it. An agent that suspects a
crash can write the reproduction. Each of those is a command with an exit code, executed in a Sandbox,
recorded in the event log — the same primitive [ADR-0014](0014-verification-oracle-is-authoritative.md)
already relies on. A reader checks it in seconds by looking at the exit code, and can re-run it.

The distinction that has to be got right, because it is the one that would otherwise reintroduce
[UF-3](../02-architecture.md): **evidence proves the
demonstration, not the judgement.** A failing test proves that a test fails. Whether the failure
matters, whether the behaviour is a bug or an intended edge case, and whether the change should be
made are all still human calls. Evidence makes a claim checkable; it does not make the advisory lane
verified.

## Decision

Wherever it is possible, an advisory agent MUST produce an artifact rather than an opinion. Concretely:

**Every finding carries an `evidence_state`, and there are exactly two values** (FR-088):

- `demonstrated` — the finding references an **evidence record**: an argv vector, the tree it ran
  against identified by commit and patch digest, its exit code, its normalised output, and the Run,
  Task and Attempt that produced it. The same executor and the same normaliser as the verified lane
  ([06-verification-and-truthfulness.md](../02-architecture.md)); no
  second implementation.
- `unverified` — no such record exists. The agent MUST say so on the finding itself, in those words,
  and MUST NOT omit the finding to avoid the label.

**A finding MUST NOT be emitted with no evidence and no label.** Silence is not a third state. An
agent that has a concern it cannot demonstrate says so; an agent that suppresses the concern to keep
its evidence ratio high has made the output worse.

**Presentation MUST distinguish the two** (FR-089), in the console, in the pull-request comment body,
and in any export. A `demonstrated` finding leads with its command and exit code. An `unverified`
finding leads with the word *unverified*. They MUST NOT share formatting, and a test asserts it.

**The ratio is recorded and reported per class** (FR-090). Share of findings carrying evidence is a
first-class metric on the effectiveness dashboard
([02-architecture.md](../02-architecture.md)),
because it is the number that says whether this decision is being honoured or quietly abandoned.

**Evidence is produced in an evidence workspace, never in the reviewed branch.** An advisory Run may
write and execute inside its own Sandbox workspace in order to produce evidence; it MUST NOT patch the
branch under review, MUST NOT push to it, and MUST NOT submit an approving review
([19-repository-access.md](../02-architecture.md)). Evidence is delivered as an
attached artifact and, where the customer enables it, as a branch under the reserved prefix that the
reviewer may fetch.

**An evidence record is not a verification result.** It MUST NOT be recorded as a
`verification_completed` event, MUST NOT satisfy INV-2, and MUST NOT allow a Task to be marked
successful. Its event kind is distinct precisely so that no query can confuse the two.

## Alternatives considered

### Comments only, with prompt instructions to be cautious — rejected

The advocate's case is real and it is about cost. Evidence production means a Sandbox, a workspace, a
model call that writes code rather than prose, and an execution — several times the cost of a comment,
for a finding the reviewer may dismiss in one second anyway. Comments are also more general: many
legitimate observations ("this name is misleading", "this duplicates the helper two files up") have no
executable form at all, and a system that only emits what it can demonstrate will stay silent about
them. Every competing product in this category made this trade and shipped.

It loses because a comment is not checkable and a machine can produce them faster than a human can
evaluate them, so volume converts a benefit into a burden. The generality objection is answered by the
`unverified` label rather than by dropping the requirement: an observation with no executable form is
still emitted, and it is honestly marked. What is rejected is *dressing a guess in the formatting of a
proof*, not having guesses.

### Emit only demonstrable findings and discard the rest — rejected

The case: maximum signal, zero noise, and a strong claim — every finding we publish is backed by an
exit code. It would make the advisory lane look almost as trustworthy as the verified one.

Rejected because it makes the system lie by omission, which this repository treats as the same defect
as lying outright. A reviewer reading only demonstrable findings would reasonably conclude the agent
found nothing else, and the most valuable observation in a review is often the one that cannot be
tested. It would also create a direct incentive to suppress uncertainty, which is the behaviour the
whole design exists to prevent.

### A confidence score per finding instead of a two-state label — rejected

The case: reviewers understand gradations, and "0.8" carries more information than "unverified".

Rejected for the reason [ADR-0022](0022-two-lanes-verified-and-advisory.md) rejects it at Run level. A
score is a model output; `demonstrated` is a recorded exit code. A binary that means something is worth
more than a continuum that means whatever the model felt, and a number invites arithmetic — averaging
confidences across findings would produce a summary figure with no referent.

### Require evidence but let the agent choose whether to attempt it — rejected

The case: the agent knows best whether a concern is demonstrable, and forcing an attempt wastes budget
on findings that were never going to be testable.

Rejected because "the agent decides how hard to try" is unmeasurable, and the evidence ratio would drift
downward invisibly as the cheap path won. The attempt is bounded by the same attempt cap and budget
admission as everything else, so the cost is capped; and a failed attempt at evidence is itself
recorded, which is information.

## Consequences

### Positive

The advisory lane's output becomes checkable in seconds instead of re-derivable in minutes, which is
the difference between reducing review load and adding to it. It is also the one thing in this category
that is expensive to copy: producing a failing test requires the sandbox, the patch applier, the
executor and the audit trail that this architecture already has and a comment-generating tool does not.
The `unverified` label makes the system's uncertainty legible, which is consistent with every other
truthfulness rule here. And the evidence ratio gives the advisory lane a metric that is not a
popularity contest.

### Negative — mandatory

**Advisory Runs stop being cheap.** Each evidence attempt is a model call that writes code plus a
Sandbox execution. A review of a large pull request with several concerns could cost more than a
dependency upgrade, and the ceiling that bounds it will sometimes cut a review short — which the
reader will experience as an incomplete review, not as a budget working correctly.

**The advisory lane inherits the isolation surface.** It needs a Sandbox, a writable workspace and the
verification executor, so the "read-only, no sandbox, almost no adoption risk" characterisation of
review work in [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) no longer holds. Every
isolation gate now applies to a capability that was previously exempt, and `FR-084` — which forbade a
review class from producing a patch at all — has to be withdrawn.

**A demonstrated finding can still be wrong, and it will look more right than it is.** A test that
fails may be testing something the maintainer deliberately does not support. Evidence raises the floor
on checkability and does nothing for relevance, and the reader's trust in the exit code may transfer to
the judgement wrapped around it. That is a genuine new failure mode created by this decision.

**Writing a failing test for a suspected bug is hard**, and the first measurements will probably show
a low evidence ratio. That number will be uncomfortable and the temptation will be to relax the rule
rather than narrow the class. The rule is the differentiator; the class is negotiable.

**Two output shapes to render and to export**, each with its own formatting contract and its own test,
in every surface that shows findings.

## Revisit when

Either: the measured evidence ratio for the first advisory class stays low enough that the lane is
mostly `unverified` findings, in which case the honest response is to narrow to the concern types that
*are* demonstrable — not to drop the label; or a reviewer-facing measurement shows that
`demonstrated` findings are dismissed at the same rate as `unverified` ones, which would mean evidence
is not buying trust and the cost is not justified.
