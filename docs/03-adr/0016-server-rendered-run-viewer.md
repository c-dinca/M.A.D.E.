# ADR-0016 — Server-rendered run viewer; no single-page application in v1

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** FR-067, NFR-021, [12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)

## Context

The operator needs to see a Run: its timeline, its cost, which Task is where, and what verification
said. Reading SQL is not an acceptable answer for a product that will be installed by someone else.

But the delivered artifact of this system is a branch and a pull request, consumed in a git host's
interface. The viewer is an operational surface for one person at a time, not the product.

## Decision

The API process serves server-rendered HTML from the same Python application, with a small amount of
progressive enhancement for polling. No separate frontend build, no JavaScript framework, no separate
process, no separate deployment artifact.

Pages in v1: Run list, Run detail (event timeline with per-step cost, Tasks with verification results,
artifacts, spend against ceiling), Project list and detail, and an approval action.

Display rules are product requirements, not styling
([06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)):
verification status renders as *verified*, *failed verification* or *not verified*; a Run in
`AWAIT_HUMAN` renders as "waiting for approval" with its reason, never as a progress spinner; unknown
values render as "unknown", never as zero.

## Alternatives considered

### A React or Svelte single-page application — rejected

The strong case: a real interface for a real product. Live updating without full-page reloads, a
filterable event timeline, a proper diff viewer with syntax highlighting, and an approval flow that
shows the patch inline — all of which materially improve the review experience, which is the moment
the customer decides whether the output is trustworthy. It is also what a buyer expects a modern
product to look like, and appearance affects the sale.

It lost on cost against the one-operator principle. A separate application means a build toolchain, a
dependency tree with its own vulnerability surface, a deployment artifact to version alongside the
backend, and API contracts to keep in step — and it competes for the founder's time with the isolation
boundary and the evaluation harness, which are what the product is actually sold on. The strongest
part of its case, the diff viewer, is already better solved by the git host's pull-request interface,
which is where the reviewer will look anyway.

### A terminal UI only, with no web surface — rejected

The case: the operator is already in a terminal, a TUI is fast to build, and it fits the audience.

Rejected because the approval flow needs to be linkable and shareable — a lead developer approving a
plan should be able to open a URL — and because "there is no interface" is a poor answer during a
security review, where being able to show the audit timeline on screen matters.

## Consequences

### Positive

One process, one deployment artifact, one language, one dependency tree
([NFR-021](../01-product/04-non-functional-requirements.md)). Templates are testable in the same test
suite as the API. Nothing to build at install time, which protects the bootstrap budget in
[NFR-020](../01-product/04-non-functional-requirements.md). The truthful-rendering rules are enforced
by ordinary server-side tests rather than by a browser harness.

### Negative

The interface will look dated next to a competitor's, and that has a real cost in a demo. Live
updating is polling, so a long Run produces repeated full-page requests — acceptable for one operator,
not for many concurrent viewers. There is no rich diff view in the product, so a reviewer inspecting a
patch before approval sees plain text or goes to the git host. And if a customer later requires a
richer interface, the migration is a rewrite of the presentation layer rather than an extension —
though the API is already the boundary, so the backend survives.

## Revisit when

Either a design partner asks for a richer review surface as a purchase condition, or more than one
person needs to watch Runs concurrently in normal use. Even then, the first move is a small
JavaScript-enhanced page for the Run timeline, not a full application.
