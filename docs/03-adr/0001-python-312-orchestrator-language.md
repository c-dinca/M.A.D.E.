# ADR-0001 — Use Python 3.12 for the control plane and agent layer

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** [07-deferred.md](../07-deferred.md)

## Context

The system is one deployable control plane containing an HTTP API, a graph executor, agent nodes, a
prompt assembler, a tokeniser-driven budget checker, a tree-sitter-based repository index, a sandbox
provider and an evaluation harness. It is built and maintained by one engineer whose stated background
is DevOps and virtualisation rather than a specific application language.

Language choice here is mostly a question of which ecosystem the unusual components come from. The API
and the database access are commodity work in any modern language; the tokenisers, the tree-sitter
bindings, the provider SDKs and the evaluation tooling are not.

## Decision

The control plane, agent layer, tools, sandbox provider and evaluation harness MUST be written in
Python 3.12. Type hints are mandatory and `mypy --strict` is a CI gate
([07-deferred.md](../07-deferred.md)).

3.12 rather than the 3.11 floor the intake mentions, for the improved error messages and the typing
features the artifact schemas rely on. No dependency in the stack requires an older interpreter.

## Alternatives considered

### TypeScript / Node — rejected

The strong case: LangGraph has a first-class TypeScript implementation, so the orchestration choice is
not a constraint. One language would cover the API, the run viewer and the orchestrator, removing a
context switch. The type system is better than Python's for modelling discriminated artifact unions,
which is most of what the schemas are. Async IO is the default rather than an overlay.

It lost on the unusual components. Tokenisers, tree-sitter bindings and evaluation harness tooling are
consistently Python-first and better maintained there; every technique published for agentic coding
arrives as Python months before anything else. Choosing TypeScript would mean either reimplementing
those pieces or running a second runtime for them, which for a single operator is worse than a context
switch.

### Go — rejected

The strong case: a single static binary is a genuinely better artifact for a self-hosted product,
installation gets simpler, memory behaviour is predictable, and the sandbox and provider layers are
systems code where Go is a natural fit. The `NFR-024` memory ceiling would be trivially met.

It lost on iteration speed in the layer that changes most. Prompts, artifact schemas and routing rules
will be rewritten dozens of times in the first months; Go's verbosity around dynamic JSON and the
absence of the AI tooling ecosystem tax exactly that loop. Go remains the right choice for a future
guest agent or a standalone sandbox supervisor, which is a component decision rather than a project
one.

## Consequences

### Positive

Every unusual component has a maintained library. The evaluation harness can reuse existing tooling.
Hiring or contracting help later draws on the largest available pool for this problem domain.

### Negative

Deployment ships an interpreter and a dependency tree rather than a binary, which makes the installer
heavier and the supply chain wider — mitigated by hash-pinned dependencies and a scan gate, but not
eliminated. Runtime type errors remain possible despite strict typing, so schema validation at every
agent boundary is mandatory rather than optional. Python's memory footprint under concurrency is
worse than the alternatives, which is why `NFR-024` exists as a checked budget rather than an
assumption. And a single-binary distribution, which would be the better artifact for a self-hosted
product, is not available to us.

## Revisit when

The sandbox supervisor becomes a separate process on a separate host
([02-architecture.md](../02-architecture.md), scaling step
3). At that point the supervisor is a candidate for Go on its own merits, without disturbing the
control plane.
