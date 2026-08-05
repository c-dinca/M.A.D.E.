# ADR-0007 — Git holds project state; graph state holds references, never file contents

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-2, UF-5, [05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md)

## Context

The graph carries a state object between nodes, and something must represent the code being changed.
The project intake proposes a `project_structure` dictionary mapping file paths to their contents,
with a reducer that merges granular updates.

That is a reasonable first instinct — one object, no external system, everything the agents need in
one place — and it is wrong for three compounding reasons that only appear at scale: the checkpoint,
the prompt, and the reviewer.

## Decision

The workspace lives in git. Each Run works on a branch created from the declared base commit; each
accepted patch becomes a commit with trailers naming the run, task, attempt, verification command,
model and prompt version ([FR-044](../01-product/03-functional-requirements.md)).

The graph state holds **references only**: base commit, branch, head commit, artifact digests, Task
identifiers, attempt records. File contents MUST NOT appear in graph state, and a Sandbox's workspace
is populated from the control plane's git mirror rather than mounted or serialised through the state
object.

A workspace is reconstructible from `(base commit, ordered patch artifacts)`, which is what makes a
Run reproducible on a fresh Sandbox for debugging or evaluation.

## Alternatives considered

### A `project_structure` dict in graph state, as the intake proposes — rejected

The strong case: everything an agent needs is in one object, so no external system is required to
answer "what does the code look like now". Checkpointing gives file-level history for free. There is
no synchronisation problem between a database and a filesystem. For a small proof of concept it is
genuinely simpler, and it is the fastest way to a working demo.

It lost on three effects that compound. The state object is checkpointed at every super-step, so the
entire codebase is serialised on every step of every Run — turning an O(1) write into O(repository
size) and putting real pressure on the datastore for data that is already versioned elsewhere. Once
the code is in the state object it inevitably reaches prompts, because it is right there and
convenient, which is the exact failure
[08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md) exists to prevent. And
the reducer merging concurrent file updates is a re-implementation of version control that will be
worse than git at conflict semantics, history and diffing — for no benefit, since git is already
present in every target repository.

There is a fourth, non-technical reason that matters more than it looks: the human reviewer wants a
branch and a diff. A state dictionary is not reviewable with the tools they use, and the delivered
artifact is the product.

### A virtual filesystem abstraction over both — rejected

The case: agents see a uniform file interface; the implementation chooses git, memory or Sandbox as
appropriate. Cleaner tool signatures, and testable with an in-memory backend.

Rejected as an abstraction over one implementation. The tools already provide the narrow surface
agents need (`read_range`, `grep`, `apply_patch`), and a filesystem abstraction invites operations —
arbitrary write, delete, rename — that the patch policy exists to prevent. When an abstraction's main
effect is to widen the interface it abstracts, it is a liability.

## Consequences

### Positive

Checkpoints stay small and cheap. The delivered artifact is a branch a human reviews with normal
tools. Provenance is in commit trailers, where a reviewer actually looks. Rollback is `git reset`
rather than bespoke state surgery. Runs are reproducible from `(base commit, patches)`.

### Negative

Two state domains must be kept consistent: the database knows the head commit, and the Sandbox holds a
working copy — a mismatch between them is possible and must be detected, which is why the tree hash is
part of the cycle guard's input. Agents cannot see the whole repository at once, which is deliberate
but does occasionally cause a wrong edit that whole-repository visibility would have prevented. Every
workspace operation goes through the Sandbox provider rather than a local filesystem call, adding
latency and code. And a corrupted or diverged git mirror is a new failure mode that has to be detected
and repaired, whereas a state dictionary cannot diverge from itself.

## Revisit when

Never for the storage direction. The narrow question worth reopening is whether Sandboxes should hold
a real git repository (enabling `git diff` inside) rather than a plain file tree — that would simplify
patch extraction, at the cost of putting git history inside an untrusted environment. It is a small
decision, and it should be made on measurement of patch-extraction cost.
