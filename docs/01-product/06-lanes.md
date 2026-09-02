# Lanes: verified and advisory

Every piece of work this system does is in exactly one **lane**, and the lane is the most important
fact about it. It is declared when a work class is declared, recorded on every Run, and never inferred
at run time ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)).

The distinction is not a taxonomy. It is a boundary between two different trust models, and this
document exists because the failure mode is a single sentence: **advisory output borrowing the
credibility of verified output.** A suggestion rendered in the typography of a proof destroys the value
of both — the proof stops meaning anything and the suggestion was never worth that much.

## The two lanes

| | Verified lane | Advisory lane |
| --- | --- | --- |
| **The question** | Did the declared command exit zero? | Is this judgement good? |
| **Who decides** | The exit code | A human |
| **Work** | Dependency upgrades, migrations, code fixes, test generation, codemods | Pull-request review, bug-finding, TODO triage, turning a chat message into a change request |
| **Output** | A branch, a pull request, an attempt trail | Findings, each with evidence or an *unverified* label |
| **Reported as** | *verified*, *failed verification*, *not verified* | Findings and their evidence state — **never** those three words |
| **Quality known** | Per Run, immediately, by proof | Per class, over time, statistically |
| **Guarantee** | A Task marked successful has a recorded zero exit code | **None.** Advisory output carries no correctness guarantee |

Both lanes are bounded identically. Budget admission before every model call, attempt caps, wall-clock
TTL, one Sandbox per Run, an event per effect, an audit trail. **An advisory Run is cheaper, not
freer** ([FR-093](03-functional-requirements.md)).

## Why the advisory lane exists at all

The honest answer is demand: pull-request review, bug-finding and TODO triage are what the buyer asked
for, and they are the capabilities a non-developer can see the value of. Refusing them would have meant
refusing most of the product.

The honest cost is that this lane ships on a weaker guarantee than the rest of the system, and it
cannot be gated the way the verified lane is. **A bad advisory class looks identical to a good one
until enough humans have accepted or dismissed enough findings.** That is not a gap in this
specification; it is a property of work with no oracle, and it is why the previous version of this
repository refused the whole category ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)
records that argument at its strongest, because it will be made again).

What makes the trade acceptable is not optimism. It is four mechanisms, each of which has a test.

## The four rules that keep the lanes apart

### 1. Advisory work is never reported in the verified vocabulary

*Verified*, *failed verification* and *not verified* are reserved words
([06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)). An
advisory Run reports its findings, their evidence state, its cost and its terminal reason. It reports
nothing that implies an oracle ran on the judgement ([FR-086](03-functional-requirements.md)).

There is one word the two lanes share deliberately: **unverified**. A Run whose verification did not
run is *not verified*; a finding with no evidence is *unverified*. The reader's conclusion is the same
in both cases — nobody checked — and using a softer word for the advisory case would be the exact
credibility transfer this document exists to prevent.

### 2. Advisory findings carry evidence, or say they do not

This is the constraint that separates the lane from the crowded field of comment-generating tools, and
it is a requirement rather than a preference
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)).

Wherever it is possible, an advisory agent produces an **artifact rather than an opinion**. Not "this
change looks risky" but the failing test that demonstrates the bug; not "this may regress" but the
benchmark that shows it; not "this could crash" but the reproduction case. Evidence is checkable by the
reader in seconds. An opinion has to be re-derived, and at the volume a machine produces opinions, that
converts a benefit into a tax on review.

Every finding therefore carries an `evidence_state` with exactly two values
([FR-088](03-functional-requirements.md)):

**`demonstrated`** — an **evidence record** supports it: an argv vector, the tree it ran against
identified by commit and patch digest, its exit code, its normalised output, and the Run, Task and
Attempt that produced it. Produced by the same executor and normalised by the same normaliser as the
verified lane. There is no second implementation.

**`unverified`** — no such record exists, and the finding says so in that word.

Three rules follow, and each closes a way this could be gamed:

- **A finding is never emitted with no evidence and no label.** Silence is not a third state. An agent
  that suppresses a concern it cannot demonstrate, in order to keep its evidence ratio high, has made
  the output worse — and a system that only emits what it can prove lies by omission, because a
  reviewer would reasonably conclude nothing else was found.
- **Presentation distinguishes the two** ([FR-089](03-functional-requirements.md)), in the console, in
  the pull-request comment body and in every export. A `demonstrated` finding leads with its command
  and exit code; an `unverified` finding leads with the word *unverified*. They do not share
  formatting, and a test asserts it.
- **The ratio is measured and published** ([FR-090](03-functional-requirements.md)). Share of findings
  carrying evidence, per class, on the effectiveness dashboard — because it is the number that shows
  whether this rule is being honoured or quietly abandoned.

**Evidence proves the demonstration, not the judgement.** A failing test proves that a test fails.
Whether the failure matters, whether the behaviour is a bug or a deliberate edge case, and whether
anything should change are human calls. This is the sentence to keep in mind when the temptation
arrives to describe a `demonstrated` finding as verified: `demonstrated` is a claim about a command,
*verified* is a claim about a Task, and they are not the same claim.

### 3. Advisory output cannot satisfy a verified-lane gate

No finding may mark a Task successful, release an approval, close a `TASK_FAILED` escalation, or count
as human acceptance in any metric ([FR-092](03-functional-requirements.md)). An evidence record is not
a verification result: it has its own event kind, it does not satisfy INV-2, and no query can confuse
the two.

An advisory Run may **write and execute inside its own Sandbox workspace** in order to produce evidence.
It may not patch the branch under review, may not push to it, and may not submit an approving review
([FR-091](03-functional-requirements.md),
[ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). Evidence is delivered as an
attached artifact and, where the customer enables it, as a branch under the reserved prefix that the
reviewer can fetch and run.

> **A requirement was withdrawn here, and it should be visible.** [FR-084](03-functional-requirements.md)
> previously required a review-only class to run with a read-only toolbelt and to be incapable of
> producing a `Patch` at all. The evidence requirement makes that impossible, because writing a failing
> test is producing a patch. FR-084 is marked **Withdrawn** and its ID is retired; FR-091 replaces it
> with a narrower boundary — write only inside the evidence workspace, never the reviewed branch. The
> consequence, stated plainly: the advisory lane is no longer the cheap read-only capability
> [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) assumed, and it now
> inherits every isolation gate it was previously exempt from.

### 4. Effectiveness is reported per lane and per class, and never blended

A single acceptance rate across both lanes is forbidden ([FR-094](03-functional-requirements.md)). The
reason is the same one that requires cost per successful Run and cost per failed Run to be reported
separately ([07-cost-control.md](../02-architecture/07-cost-control.md)): the average of two numbers
that mean different things hides the one that matters, and it hides it in our favour.

The measures per lane are genuinely different objects:

| Verified lane | Advisory lane |
| --- | --- |
| Acceptance rate: pull requests merged with **no human edit to the diff** | Advisory acceptance rate: findings resolved by a change |
| Cost per merged pull request | Cost per accepted finding, and evidence ratio |
| Intervention rate: Runs needing a human to progress | Dismissal rate, and dismissal reason where recorded |

A reviewer dismissing a finding is not a failure of the system in the way a failed verification is. It
is the lane working: the agent proposed, the human decided. That is why the number is reported and not
alerted on.

## The interface obligation

Every surface makes the lane visible **before** the content, and renders a verified result differently
from a suggestion ([FR-087](03-functional-requirements.md)). This is a product requirement with a test,
not a styling preference, and it applies to the console, to pull-request comment bodies, to the CLI and
to every export.

The published statement is not a disclaimer to be minimised: **advisory output carries no correctness
guarantee.** It appears in the interface, in those words. It is the sentence that makes the verified
lane's guarantee mean something, and hiding it would be the first step to having neither.

## Which classes are in which lane

The catalogue is in [05-work-classes.md](05-work-classes.md). Assignment is not a judgement call — it
follows from one question: **is there a command, declared before the work starts, whose exit code
decides the outcome?** If yes, verified. If no, advisory. If the answer is "we could write one", the
class is not ready to be declared.

Three cases are worth naming because they are the ones that get argued about.

**`test_gap` is verified**, because the oracle is real even though it is weak: the new test must fail
against the pre-change tree and pass after. That proves the test runs and exercises the change. It does
not prove the test is a *good* test, and [05-work-classes.md](05-work-classes.md) marks the oracle
Medium for exactly that reason.

**TODO triage is advisory**, even though counting TODOs is trivially a command. The count is not the
work; deciding which TODOs are worth acting on is, and that is a judgement.

**Turning a chat message into a change request is advisory**, and it is the one advisory class whose
output is not a finding — it is a brokered invocation or a decline
([08-chat-front-door.md](08-chat-front-door.md)).

## What is deliberately not built

**No confidence score, at Run level or finding level.** A score is a model output, and this
architecture's central rule is that a model's opinion never decides anything. A float attached to an
unproven claim looks like a measurement, is not one, and invites averaging.

**No third lane.** "Mostly verified", "verified with caveats" and "high confidence" are all the same
mistake: a gradient where a boundary is needed. If a class needs a third category, the honest reading
is that it is two classes.

**No advisory-lane escalation into the verified lane.** An advisory Run that discovers a fixable
problem does not start a verified Run to fix it. It emits a finding with evidence, and a human — or a
declared work class triggered by a human — does the fixing. An agent that can promote its own output
across the lane boundary has erased the boundary.

**No suppression of low-confidence findings by default.** Filtering is the reader's decision and it is
made in the console, against the evidence state, on data that was recorded. Discarding findings before
anyone sees them would make the evidence ratio meaningless and the omission invisible.
