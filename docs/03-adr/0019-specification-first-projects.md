# ADR-0019 — Specification-first Projects: the generated specification bundle as a Run's first output

**Status:** Proposed — **not in force.** Nothing in v1 implements this.
**Date:** 2026-08-06
**Relates to:** OQ-03, [ADR-0014](0014-verification-oracle-is-authoritative.md), [ADR-0018](0018-spec-as-contract-and-spec-lint.md), [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) (Seam 4)

## Context

v1 changes existing repositories, and the reason is narrow and specific: the verification oracle that
carries [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) needs a test
harness that already exists and that the system did not write. Greenfield generation was excluded
because a scaffold passing its own generated tests proves nothing (OQ-03, Seam 4).

The proposal recorded here is that **every software project built with M.A.D.E. should begin by
producing a specification bundle of the kind this repository contains** — normative contracts, an
architecture document set, a binding glossary, an `AGENTS.md`, and a backlog of collision-proof work
items — after which agents implement from it.

This matters enough to record even though it is not being built, because it **changes the answer to
the question that blocked Seam 4.** The objection to greenfield was the absence of an oracle. A
specification phase has one:

`spec-lint` is executable ([ADR-0018](0018-spec-as-contract-and-spec-lint.md)). Schemas either parse
against their meta-schema or they do not. An OpenAPI document either validates or it does not. DDL
either parses against the Postgres grammar or it does not. State enumerations either agree across the
contract, the schema and the DDL or they do not. Every internal link either resolves or it does not.
Every backlog item either declares Reading, Touches, Role, acceptance criteria and dependencies or it
does not. Every requirement either has an identifier and a named test or it does not. **That is an
exit code**, which means a specification phase can satisfy
[ADR-0014](0014-verification-oracle-is-authoritative.md) rather than being an exception to it — which
is precisely what every other candidate greenfield mechanism could not do.

Contract-first ordering then gives the *implementation* phase an oracle ladder on a repository that
started empty: schema validity, then conformance of the implementation to the published contract, then
type check and lint, then acceptance tests written by the QA agent under the double-execution rule
([06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)). Each
rung is weaker than a mature test suite and stronger than nothing, and each is a real exit code.

Two further alignments make this less of an addition than it appears. The backlog in such a bundle
**is** a `TaskGraph` — items map one-to-one onto Tasks with a verification command, dependencies and a
path scope — so the Architect would be producing a durable, human-reviewable, version-controlled form
of an artifact it already produces per Run. And the `Touches` field, which is a convention between
agents in this repository, becomes machine-enforceable inside M.A.D.E.: the patch policy validator can
reject a patch that modifies a path outside the current Task's declared scope, which bounds blast
radius per Task rather than per Run.

## Decision (proposed)

Introduce a Project `mode`. `change` is v1 behaviour: operate on an existing repository, planning
artifacts stay per-Run and ephemeral. `create` adds a **specification phase**: a Run whose output is a
specification bundle committed to the target repository, gated on `spec-lint` passing inside a Sandbox
and on human approval of the contracts and the backlog. Subsequent Runs in that Project read the
committed backlog as their `TaskGraph` instead of generating one.

Specification depth MUST scale with the work, in three tiers, because the failure mode of this idea is
producing forty documents for a small change:

| Work | Specification output |
| --- | --- |
| A single change to an existing repository | None. v1 behaviour: ephemeral `Spec` and `TaskGraph` artifacts |
| A feature or subsystem | A `Spec`, a `TaskGraph` and any contract changes the feature requires |
| A new project, or a subsystem large enough to need its own vocabulary | The full bundle |

Normative authority is confined to what is checkable. Generated **contracts** are normative once they
pass real validators. Generated **prose** is advisory and carries no authority a validator did not
give it — the same rule this repository applies to itself
([docs/README.md](../README.md#document-conventions)).

A generated bundle MUST additionally ship an **evidence register** of the kind in
[00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md): every
load-bearing claim classified as proven by execution, internally consistent but unproven, assumed, or
declined as an open question. Without it the customer receives an authoritative-looking document with
no way to tell which parts were checked, which is the failure this ADR's negative consequences
describe. The register is generated from the same `spec-lint` report that gates the phase, so it is a
by-product rather than more prose to trust.

## Alternatives considered

### Keep all planning ephemeral, as v1 does — rejected for `create` mode, retained for `change` mode

The strongest case, and the one that wins for the majority of work. Per-Run `Spec` and `TaskGraph`
artifacts are already content-addressed, already audited, already reviewable at the plan-approval
gate, and cost a small fraction of a document bundle. Committing documents into a customer's
repository is an opinionated intrusion that many teams will resent, and a committed specification that
rots against the code is worse than none, because an agent reads it and implements the past. Most
changes need a plan, not a library.

It loses only in the case it was never designed for: a repository that does not exist yet. There is
nothing to plan against, no vocabulary to inherit, no oracle to run, and no way for several agents to
divide work without colliding. That is exactly the gap the bundle fills, which is why the decision is
a mode rather than a replacement.

### Generate the bundle but keep it in our object store rather than the customer's repository — rejected

A real case: no intrusion into their tree, still durable, still versioned by digest, still reviewable
in the run viewer, and it cannot rot against the code because it is not presented as part of the code.

Rejected because the value of `Reading` and `Touches` depends on being co-located with what they
describe. A future agent — including the customer's own tooling, and the human reading a pull request
six months later — looks in the repository, not in our object store. There is also an adoption
argument that matters for a self-hosted product sold to cautious buyers: a specification the customer
keeps is a deliverable that survives them stopping using us, which lowers the perceived risk of
starting.

### A curated template that ships with a real harness — rejected as insufficient, retained as complementary

This was Seam 4's original candidate, and it is genuinely good: the first Run inherits a test harness
it did not write, so the oracle problem disappears for the scaffold.

It loses as a *complete* answer because it only covers the shape of project someone wrote a template
for, and the interesting projects are the ones nobody templated. It remains complementary: a template
can supply the harness while the bundle supplies the contracts and the work breakdown.

### Full bundle for every Run regardless of size — rejected

Its case is consistency: one path, no mode, no tiering, no judgement about depth. Rejected on cost
arithmetic alone. A bundle is many expensive-tier calls; spending that on a one-file change is
indefensible, and the budget guards would kill the Run before it produced any code — which would look
like a system defect rather than a design choice.

## Consequences

### Positive

Greenfield acquires a defensible oracle story rather than an excuse. Planning becomes durable and
reviewable instead of ephemeral. Several agents can divide work on a new codebase from the first day,
because `Touches` and `Reading` exist before the code does. `Touches` becomes enforceable, bounding
blast radius per Task. Every project accumulates a specification-to-outcome record that is an
evaluation asset and hard for a prompt-to-code competitor to reproduce.

### Negative — mandatory

**A confidently wrong specification is more dangerous than no specification.** Every agent complies
with it consistently, so errors compound instead of cancelling out, and the resulting code is coherent
and wrong. This is a genuinely new failure mode that v1 does not have, and it is the reason normative
authority is confined to machine-checked artefacts. It is not fully mitigated by that, only bounded.

**Cost, and a two-tier budget problem.** A specification Run's ceiling has no relationship to a code
Run's ceiling, so either budgets become mode-aware or the guards kill legitimate work. Mode-aware
budgets are a change to the one mechanism that most directly carries
[UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), which is not a change
to make casually.

**Human review load moves earlier and grows.** Reviewing a specification is harder than reviewing a
diff, and the gate is now on the most consequential artefact. Gating only on contracts and the backlog
helps and does not eliminate it.

**`spec-lint` becomes a product surface.** It stops being an internal CI script and acquires users, a
compatibility promise, and failure modes that block customer Runs. Its false positives become their
problem, not ours.

**Specification drift becomes a customer-facing problem.** The mechanism that protects this repository
— a required lint gate in CI — must be something we install in theirs, which means we are now
opinionated about their pipeline.

**Time to first useful output grows substantially**, and it grows in the phase where the customer has
seen nothing working yet. That is the worst place in the funnel to add latency.

## Revisit when

All three of these hold, and not before:

1. **OQ-03 is resolved in favour of `create` mode** by a design partner who actually wants new
   projects built, not existing ones changed.
2. **`spec-lint` exists as a library with a machine-readable report** and can run as a
   `verification_command` inside a Sandbox — the change to `SPEC-01` that makes this cheap has already
   been made, so this is a matter of using it rather than building it.
3. **The golden suite has a `spec_generation` tier** measuring two things: whether a generated bundle
   passes `spec-lint`, and whether its backlog items are individually verifiable when handed to an
   implementation Run. Without that measurement, adopting this is a guess about the most expensive
   phase in the product.
