# ADR-0020 — Technical-debt remediation on existing repositories is the v1 product

**Status:** Accepted
**Date:** 2026-08-14
**Relates to:** OQ-03 (resolved by this ADR), [ADR-0014](0014-verification-oracle-is-authoritative.md), [ADR-0019](0019-specification-first-projects.md) (withdrawn by this ADR), [01-product/05-work-classes.md](../01-product/05-work-classes.md)

## Context

The specification was written against an ambiguous product intent, and OQ-03 recorded the ambiguity
honestly: does the system change existing repositories or generate new projects. The founder has now
stated the intent directly, and it is neither of the framings the intake implied.

The target is **the maintenance burden of existing codebases**: dependency upgrades, chores,
repetitive review, dead code, lint and type debt, mechanical migrations. The buyer is a software
engineering organisation — explicitly including the outsourcing hubs in Bucharest and Cluj — whose
economics are people-hours and whose maintenance work is simultaneously contractually required,
low-margin, hard to staff, and universally disliked. Scaling that work by hiring is no longer
sustainable for them.

This resolves three problems at once, which is why it is worth an ADR rather than a scope note.

**It supplies the oracle that was missing.** The hardest unanswered question in the specification was
whether a verification command could be produced reliably per Task (OQ-07). For maintenance work the
question largely dissolves: the oracle is the repository's **existing** test suite, which the system
did not write and cannot influence. "Upgrade this package; the suite must still pass" is a complete,
unambiguous, machine-checkable definition of done. It is the strongest oracle available anywhere in
this design, and it arrives for free.

**It is unattended by nature, which is where the incumbent tools are the wrong shape.** Claude Code
and Cursor are interactive: their entire design assumes a human at a keyboard approving steps and
noticing when a run goes wrong. Nobody watches a package bump. Maintenance work is recurring,
scheduled, high-volume and boring — precisely the conditions under which enforced budgets, guaranteed
termination and a complete audit trail stop being nice-to-have and become the product. The properties
already specified here — pre-flight budget admission, the progress oracle, the append-only event log,
the fail-closed sandbox — are control-plane properties, not editor properties.

**It gives the self-hosted architecture a better justification than a security veto.** An outsourcing
hub cannot send a client's source to a third party, because the client contract forbids it. That is a
far easier sale than persuading a CISO to be less anxious: it is a contractual constraint with a
yes-or-no answer, and [ADR-0013](0013-single-tenant-self-hosted-v1.md) already satisfies it.

## Decision

The v1 product is **autonomous remediation of technical debt in existing repositories**, delivered as
pull requests a human reviews and merges.

- Target repositories always exist and always have a passing baseline verification command. Refusal at
  registration ([FR-004](../01-product/03-functional-requirements.md)) stands and is now a product
  boundary rather than a limitation.
- Work is organised into **work classes**, each with a declared task template and a declared oracle.
  The catalogue, the ranking and the first class to build are in
  [01-product/05-work-classes.md](../01-product/05-work-classes.md).
- A Run may be created by a schedule as well as by a person
  ([FR-082](../01-product/03-functional-requirements.md)), because recurring unattended execution is
  the shape of the work.
- **The Architect is no longer on the critical path to the first sellable capability.** A work class
  supplies a fixed task template, so the first product ships with a deterministic plan and no planning
  model call ([FR-081](../01-product/03-functional-requirements.md)). Generated planning remains
  specified and moves behind the first revenue.
- Greenfield generation is **out of scope**, and OQ-03 is closed accordingly.

## Alternatives considered

### General-purpose feature development — rejected

The strongest case, and the one everyone wants to buy: hand the system a ticket and receive a feature.
The market is far larger, the perceived value per Run is much higher, and it is the story that raises
money and excites a demo audience. It is also what the intake's framing implied.

It loses on three grounds that compound. There is no reliable oracle per Task — that is the whole of
OQ-07, and it does not dissolve for feature work, it gets worse, because "did this implement what was
meant" is a judgement call. The work is *attended*: a human is watching, iterating and correcting,
which is exactly the shape Cursor and Claude Code already fit better than we ever will, and competing
there means competing on model quality, which is rented and compounds for nobody. And the failure
mode is unbounded: a wrong feature is expensive and invisible, whereas a wrong package bump turns the
test suite red.

### Greenfield project generation via a specification phase — rejected, withdrawing ADR-0019

Its case was genuinely strong and is preserved in
[ADR-0019](0019-specification-first-projects.md): a specification phase has an executable oracle in
`spec-lint`, contract-first ordering gives the implementation phase a real oracle ladder, and the
generated backlog is a durable task graph. It solved the problem it set out to solve.

It loses to this decision on demand rather than on design. Nobody has said they want new projects
built; the founder has said the opposite. It also puts us in the most crowded and least defensible
segment, against browser prototyping tools with far more funding, and it maximises time-to-first-value
in a product whose adoption risk is already installation. ADR-0019 is marked **Withdrawn** with its
reasoning intact, because the two seam items it justified — `spec-lint` as a library, and an enforced
`touches` scope per Task — pay for themselves here and are retained.

### A pull-request review bot only — rejected as the v1 product, retained as a work class

A real case, and the fastest thing to sell: review is advisory, so it writes nothing, which means it
carries almost no adoption risk and needs no security conversation at all. Trials are trivial. Several
companies have proven the demand.

Rejected as the *product* because the market is crowded with well-funded entrants, because advisory
output makes value soft and hard to measure — nobody can tell you what a comment was worth — and,
decisively, because it uses none of the machinery that is hard to copy. A review bot needs no sandbox,
no budget ceiling, no termination guard and no audit trail. Choosing it would mean discarding the
only durable asset in this architecture. It remains a cheap secondary work class once the platform
exists.

### Version bumping in the manner of the existing free tools — rejected

The case: proven, universal demand, trivially explainable, and simple to build.

Rejected because it is solved and free, so there is no product there. The value is precisely in the
part those tools do not do: when the bump breaks the build, they open a red pull request and a human
fixes it. That human is expensive and resents the task. **Starting where they stop is the product**,
and it requires an agent that can read the failure, locate the call sites and change the code — which
is what everything else in this repository is for.

## Consequences

### Positive

The oracle problem largely disappears for the first work class, which removes the single largest
technical risk in the specification. The differentiator moves from "we isolate execution", which many
buyers have already decided not to care about, to "unattended, budgeted, audited, on your
infrastructure", which the interactive tools structurally cannot offer. Value is measurable in a
number the buyer already tracks — the share of maintenance pull requests merged without a human
touching them. The self-hosted requirement becomes a contractual fit rather than an argument. And the
path to a sellable capability shortens materially, because the Architect and the multi-agent
orchestration leave the critical path.

### Negative — mandatory

**The story is smaller.** "A maintenance bot" raises less money and impresses fewer people than "an AI
development team", and that has real consequences for hiring, funding and attention, even though it is
easier to sell.

**Value per Run is capped.** A package upgrade is worth less than a feature, so pricing is pressured
from below by free tools and from above by the modest size of the job. Volume has to carry the model,
which makes per-Run cost control a commercial necessity rather than a safety feature.

**The repositories that need this most can benefit from it least.** A codebase with severe technical
debt usually has a weak test suite, and a weak suite is a weak oracle. So the product works best where
the problem is smallest. That inversion is uncomfortable, it will come up in every sales conversation,
and it has no engineering fix — only honest qualification at registration.

**The entry point competes with free.** Explaining "we start where Dependabot stops" is a harder first
sentence than a category nobody occupies, and some buyers will not get past "we already have that".

**A large part of the existing specification leaves the critical path.** The Architect, the TaskGraph
generation, the multi-agent roles and most of M4 are now deferred. That specification effort is not
wasted — it is the second product — but it is not the first one, and pretending otherwise would repeat
the mistake this ADR corrects.

**Breaking-change remediation is harder than it sounds.** Fixing call sites after an upgrade is a
multi-file change driven by a failure message, which stresses retrieval and the search/replace patch
format harder than a single-file edit does. The first work class is not the easy one; it is the one
with the best oracle.

## Revisit when

Either: the measured share of pull requests merged with no human edit on the first work class fails to
reach a level a buyer will pay for — in which case narrow further, to the single easiest class, rather
than broadening; or a design partner pulls hard toward feature development *and* brings a repository
whose test suite is strong enough to serve as an oracle for it, which would reopen the general-purpose
question with evidence instead of ambition.
