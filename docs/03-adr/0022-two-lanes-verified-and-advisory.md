# ADR-0022 — Work is separated into a verified lane and an advisory lane, and both ship in v1

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), [ADR-0014](0014-verification-oracle-is-authoritative.md), [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md), [ADR-0023](0023-advisory-findings-carry-evidence.md), [01-product/06-lanes.md](../01-product/06-lanes.md), FR-086, FR-087

## Context

Every document in this repository is written on one premise: a unit of work carries a command declared
in advance, and that command's exit code decides whether the work succeeded
([ADR-0014](0014-verification-oracle-is-authoritative.md)). The premise is load-bearing.
[ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) narrowed the product to work classes
precisely so that the premise always holds, and [01-product/05-work-classes.md](../01-product/05-work-classes.md)
states the rule bluntly: work with no runnable oracle is not a work class, it is a wish.

The founder's capability list breaks that premise in half. Some of the listed work has an oracle:
dependency upgrades, migrations, code fixes, test generation, codemods. Some of it structurally cannot
have one: reviewing a human's pull request, finding bugs, triaging TODO debt, turning a non-developer's
chat message into a correct change request. **There is no exit code for "is this review good".**

The existing specification handled this by admitting exactly one such capability, `pr_review`, calling
it advisory, and declaring that it is "never the product"
([ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) rejected a review bot as the v1
product). That was consistent while the review capability was a cheap by-product. It is no longer
consistent, because the founder has decided that the advisory capabilities ship in v1 as part of the
product rather than behind it.

The failure to avoid is specific and it is not "shipping advisory work". It is **advisory output
borrowing the credibility of verified output**: a comment rendered in the same typography as a proven
finding, an escalation reported with the same confidence as an exit code, a dashboard averaging the two
into one acceptance rate. That is [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)
arriving through the front door with the founder's permission.

## Decision

Work is classified into exactly two **lanes**. The lane is a property of the work class, fixed when the
class is declared, recorded on every Run, and never inferred at run time.

**The verified lane.** A command declared in advance decides the outcome. Everything already specified
in this repository — the task graph, the sandboxed execution, the six guards, the attempt caps, the
progress oracle, the event log — applies unchanged. `ADR-0014` is unmodified. A verified Run reports
*verified*, *failed verification* or *not verified*.

**The advisory lane.** No such command exists. The agent proposes; a human decides. An advisory Run
produces **findings**, never a change to the reviewed branch. Quality is measured statistically over
time, per class, from human acceptance — not proven per Run.

The rules that keep the two apart, each of which MUST be enforced in code and asserted by a test:

- An advisory Run MUST NOT be reported as *verified*, *failed verification* or *not verified*. Those
  three words are reserved for the verified lane. An advisory Run reports its findings, their evidence
  state, and nothing that implies an oracle ran on the judgement (FR-086).
- Every surface presenting output MUST make the lane visible before the content, and MUST render a
  verified result and a suggestion differently (FR-087). "Differently" is a product requirement with a
  test, not a styling preference.
- No advisory output may satisfy, close, unblock or substitute for a verified-lane gate. An advisory
  finding cannot mark a Task successful, cannot release an approval, and cannot be counted in a merge
  rate as though a human had accepted it.
- Advisory findings MUST carry evidence or be marked unverified
  ([ADR-0023](0023-advisory-findings-carry-evidence.md)).
- Effectiveness reporting MUST be per lane and per class. A single blended acceptance rate across both
  lanes is forbidden, for the same reason cost per successful Run and cost per failed Run are reported
  separately ([07-cost-control.md](../02-architecture/07-cost-control.md)).
- Every bound the verified lane has, the advisory lane also has: budget admission before every model
  call, attempt caps, wall-clock TTL, sandbox isolation, and an event per effect. An advisory Run is
  cheaper, not freer.

The advisory lane's honest limitation is a **product statement**, published in the interface and not
only in this repository: *advisory output carries no correctness guarantee.* It is not a disclaimer to
be minimised. It is the sentence that makes the verified lane's guarantee mean something.

## Alternatives considered

### Admit no advisory work, keeping the oracle premise absolute — rejected

This is the strongest case in the set, because it is the position the entire repository currently
holds, argued at length in [01-product/05-work-classes.md](../01-product/05-work-classes.md) and
[06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md). Its
argument: the only property that does not degrade when the model degrades is the exit code. A system
that fails 40% of the time and says so is usable; one that cannot tell which outputs are trustworthy is
worse than useless. Admitting a class of work whose quality cannot be proven per Run reintroduces
exactly the ambiguity the product was built to eliminate, and it does so at the customer's review
surface, where trust is actually won or lost.

It loses on demand, not on merit. Pull-request review, bug-finding and TODO triage are what the buyer
asked for, they are the capabilities a non-developer can see the value of, and refusing them means
refusing most of the founder's stated product. The mitigation for the risk is not refusal — it is that
the advisory lane is *labelled*, *bounded*, *measured separately*, and *required to produce evidence*,
so that it cannot be mistaken for the verified lane by anyone reading either output.

### One lane, with a per-Run confidence score — rejected

The case: a single pipeline is simpler, and a numeric confidence attached to every output lets the
reader decide how much to trust it. Reviewers are used to confidence scores, and one mechanism is
easier to build and to explain than two.

Rejected because a confidence score is a model output, and this architecture's central rule is that a
model's opinion never decides anything ([UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)).
A score of 0.9 attached to an unproven claim is worse than no number: it looks like a measurement,
it is not one, and it invites exactly the averaging that hides which outputs were checked. A boolean
that means "a command ran and exited zero" cannot be faked; a float cannot be trusted.

### Ship advisory work as a separate product with its own surface — rejected

A real case, and the cleanest way to guarantee the two never contaminate each other: separate
deployment, separate interface, separate brand, no shared reporting.

Rejected because it doubles the operational surface for one maintainer, it forfeits the machinery the
advisory lane genuinely needs — sandboxed execution to produce evidence, budget ceilings, the audit
trail — and because the buyer wants one system that lives in their infrastructure, not two. The
separation this decision needs is a boundary inside one system, and a boundary inside one system is
testable in one test suite.

### Keep `pr_review` as the only advisory class and defer the rest — rejected

The case: it is what the current specification already permits, it needs no new concept, and it lets
the advisory question be answered by measurement on one narrow class before widening.

Rejected because it is a scope decision dressed as a design decision. The founder has decided the
advisory lane ships; deferring all of it but one class does not remove the need for the lane
distinction, it just leaves the distinction unspecified while shipping something that needs it. Which
advisory class ships *first* is a genuine and still-open question (OQ-12), and it is recorded as one.

## Consequences

### Positive

The product can serve the capabilities the buyer asked for without weakening the guarantee it is sold
on, because the guarantee is now scoped explicitly rather than implied globally. The advisory lane
reuses the sandbox, the budget ceilings and the audit trail, so it costs a lane flag and a reporting
split rather than a second system. Reporting per lane makes the advisory lane's quality *measurable*
for the first time — an acceptance rate per class over time is a real number, where "the reviewer liked
it" is not. And publishing the limitation is a differentiator: every comment-generating tool in this
category presents guesses and proofs in the same font.

### Negative — mandatory

**The one-sentence explanation of the product gets longer.** "Nothing is called successful unless a
command exits zero" was the whole pitch. It now needs a qualifier, and a qualifier in a trust claim is
expensive — some buyers will hear "so some of it is guessing", which is accurate and unhelpful.

**The temptation to blur the lanes is now permanent and internal.** Every future dashboard, every
summary email, every pull-request template will be easier to build with one number. The pressure will
not come from an attacker; it will come from whoever is trying to make the product look good, and it
will arrive as a reasonable request.

**Advisory quality is unfalsifiable in the short run.** With no oracle, a bad advisory class looks
identical to a good one until enough humans have accepted or dismissed enough findings. That means the
advisory lane cannot be gated the way the verified lane is, so it ships on a weaker guarantee, and the
measurement that would justify it arrives after the decision to ship it.

**Two lanes double part of the reporting surface**: two acceptance definitions, two cost
denominators, two escalation meanings, and a permanent obligation never to sum them. Every metric now
needs a lane qualifier, and a metric without one is a defect rather than a shortcut.

**The advisory lane needs write and execute capability to produce evidence**
([ADR-0023](0023-advisory-findings-carry-evidence.md)), so it is not the cheap read-only class the
current specification assumes. It needs a Sandbox, a workspace and a verification executor, which
means it inherits the isolation cost it was previously exempt from — and `FR-084`, which forbade the
review class from producing a patch at all, has to be withdrawn.

## Revisit when

Either: measured acceptance rate for the first advisory class is low enough that the findings are
costing reviewers more attention than they save — in which case narrow the class rather than lower the
evidence requirement; or a mechanism is found that gives a class of advisory work a genuine oracle, in
which case that class moves to the verified lane and this ADR's boundary moves with it, which is the
outcome to hope for.
