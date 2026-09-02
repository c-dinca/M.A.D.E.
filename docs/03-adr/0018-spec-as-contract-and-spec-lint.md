# ADR-0018 — Contracts are normative and enforced by a spec-lint CI gate

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** [07-deferred.md](../07-deferred.md), [`/contracts/`](../../contracts/)

## Context

This repository's primary audience is AI coding agents working concurrently, each reading a small slice
of the specification. That working model has a specific failure: an agent reads a document that has
drifted from the code, implements what it read, and produces something that is consistent with the
document and wrong. A second agent reads a different document that drifted differently, and the two
implementations disagree at an interface neither of them owns.

Human teams absorb this through conversation. Agents cannot: they have no channel for "that document
is out of date, ask someone".

## Decision

Machine-readable files under [`/contracts/`](../../contracts/) are **normative**. Where prose and a
contract disagree, the contract wins and the prose is a defect. The source-of-truth hierarchy in
[`/AGENTS.md`](../../AGENTS.md) states this as the first rule an agent reads.

A `spec-lint` CI job enforces the parts of consistency that are checkable, and it is a required check.
It asserts:

1. Every JSON Schema, the OpenAPI document and the state machine parse and are valid against their
   meta-schemas.
2. State names in [`/contracts/state-machine.json`](../../contracts/state-machine.json) match the
   `CHECK` constraint in [`/contracts/db/0001_init.sql`](../../contracts/db/0001_init.sql), the state
   names used in prose, and the states implemented in `made/orchestrator/`.
3. Every internal Markdown link resolves, including heading anchors.
4. Every `FR-###` and `NFR-###` referenced anywhere exists, and every requirement defined is
   referenced by at least one test marker.
5. No banned synonym from [01-product.md](../01-product.md)
   appears in an identifier, an API field name or a database column.
6. Every `OQ-##` marked inline appears in the open-questions table in
   [06-open-questions.md](../06-open-questions.md), and every **unresolved** row
   in that table is marked inline somewhere. Rows struck through as resolved are exempt from the second
   direction: they are retained as a record, and their inline block is removed by the decision that
   closed them.
7. Every backlog item declares Reading, Touches, Role, acceptance criteria and dependencies.

A specification change that breaks any of these fails the build in the same way a broken test does.

## Alternatives considered

### Documentation as advisory, code as truth — rejected

The strong case, and the industry default: code cannot drift from itself, documentation always rots,
and enforcing prose consistency is ceremony that slows every change. Teams that try to keep documents
normative usually end up with stale documents *and* a slower process, which is the worst of both. Most
successful projects treat the code as the specification and generate documentation from it.

It lost because of who reads this. A human contributor discovers a stale document by asking a
colleague or by reading the code; an agent takes the document at face value and ships the divergence.
When the specification exists specifically so that agents can work without shared context, "the code
is the truth" removes the coordination mechanism entirely. Note the scope: contracts are normative,
not every sentence of prose. The lint checks structure and identifiers, not narrative.

### Generate the contracts from the code — rejected

The case: the single most reliable way to prevent drift is to have one source. Generate OpenAPI from
route definitions and JSON Schema from the Pydantic models, and disagreement becomes impossible.

Rejected on ordering. Agents implement *from* the contract, so the contract must exist before the code
does — a generated contract cannot be the input to the work that generates it. Contract-first also
makes an interface change a reviewable, standalone unit that lands before its consumers, which is what
allows several agents to work in parallel
([AGENTS.md](../../AGENTS.md)). The
compromise adopted is contract-first plus a conformance test that fails when the implementation
diverges — same guarantee, correct direction.

## Consequences

### Positive

An agent can trust the contract without reading the implementation, which is the property that makes
parallel work safe. Interface changes become explicit, reviewable and independently landable. Broken
links and dangling requirement identifiers are caught mechanically rather than by a reader noticing.

### Negative

Every interface change is now two changes — contract then implementation — in two pull requests, which
is slower for the trivial cases and will feel like bureaucracy on a one-field addition. `spec-lint` is
a tool we must build and maintain, and it will produce false positives that block work until someone
fixes the linter. Keeping the state enumeration synchronised across contract, DDL, prose and code adds
friction to exactly the change that is already hardest. And there is a standing temptation to update
the code and "fix the contract later", which produces the drift this decision exists to prevent —
which is why the check is required rather than advisory.

## Revisit when

`spec-lint` false positives block work more than roughly once a month, or maintaining it costs more
than the drift it catches. The response is to narrow the checks — dropping the weakest ones, probably
the identifier-reference checks — before abandoning the approach, because checks 1 and 2 are the ones
carrying the real weight.
