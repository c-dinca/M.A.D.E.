# ADR-0009 — Structural retrieval and a ranked repo map; no vector index in v1

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** [02-architecture.md](../02-architecture.md), NFR-014

## Context

An agent must find the code relevant to a change without receiving the repository. Two families of
approach exist: structural retrieval (a symbol index, literal search, an import graph) and semantic
retrieval (embed chunks, query by nearest neighbour).

The intake's framing of the problem is correct — a system that reads everything collapses into
confusion — but it does not settle which retrieval mechanism to use, and the choice has a large
operational footprint for a single operator.

## Decision

Retrieval in v1 is structural, in this order: a ranked tree-sitter repo map is always present; then
`symbol_def` and `references` against a tree-sitter index; then `grep`; then one hop along the import
or reference graph.

There is **no vector index, no embedding pipeline and no reranker** in v1. `pgvector` is not enabled
and no embedding provider is configured.

## Alternatives considered

### Embedding-based semantic retrieval — rejected for v1

The strong case: it answers the query class structural search cannot. "Where is rate limiting handled"
has no identifier to grep for, and an agent that must guess a symbol name to find anything will fail
on unfamiliar codebases and on conceptual requests. Embeddings degrade gracefully — an approximate
match is often good enough to orient — and `pgvector` in the database we already run means no new
process, which weakens the usual operational objection considerably.

It lost on precision for the actual workload and on the staleness tax. The dominant query in this
system is "find the definition and callers of this identifier", where an exact index is both cheaper
and strictly more accurate; embeddings return plausible neighbours, and a plausible-but-wrong file
costs an Attempt. Staleness is the harder problem: the workspace changes on every accepted patch, so
the index must be re-embedded per commit or it lies — and an index that lies is worse than no index,
because the agent trusts it. Re-embedding on every patch is a cost and a latency on the hot path.
Finally, the honest position is that we have no measurement showing structural retrieval failing;
building the index first would be solving a problem we have not observed.

### Full-repository context with a long-context model — rejected

The case: modern context windows can hold a small repository, retrieval disappears as a subsystem, and
the model sees everything so it cannot miss a caller.

Rejected on cost and on accuracy. Input tokens dominate spend and are re-sent on every Attempt, so
this scales cost with repository size times attempts — the exact shape
[02-architecture.md](../02-architecture.md) is built to avoid. Accuracy also degrades
as irrelevant material grows, so it is not a straight cost-for-quality trade; it is worse on both
axes above a modest repository size.

### A language-server (LSP) backend instead of tree-sitter — rejected

The case: real type resolution, accurate cross-file references, and correct handling of dynamic
constructs — genuinely better symbol data than a parse tree provides.

Rejected on operational cost. It requires running a language server per language per Project inside or
alongside the Sandbox, with its own lifecycle, memory footprint and failure modes — against the
four-process ceiling. Tree-sitter is a library, parses fast enough to reindex incrementally, and
degrades predictably on code it cannot fully resolve.

## Consequences

### Positive

No index infrastructure to run, no embedding provider to configure, and nothing that can go stale
silently. Retrieval is deterministic, so a retrieval bug is reproducible and testable. Repository
changes are reflected immediately, because the index is derived from the current tree. Nothing about
retrieval requires network access, which keeps the air-gapped configuration whole.

### Negative

Conceptual queries with no identifier are served poorly, and the agent must guess a search term — the
most likely cause of a failed `SPEC` on an unfamiliar codebase. Repo map quality depends on the
ranking heuristic, which is ours to tune with no principled ground truth. Each supported language needs
a tree-sitter grammar and a symbol extractor, so language support is per-language work rather than
free. And the map is lossy by construction: an agent may conclude that something absent from the map
does not exist, which is why the map must never be presented as a complete picture.

## Revisit when

Evaluation shows agents repeatedly failing to locate relevant code with structural tools — concretely,
when failures attributable to retrieval exceed 15% of failed Attempts in the harness, or when the
`ambiguous` and `multi_file` tiers plateau while `trivial` passes. At that point the first move is
`pgvector` in the existing database with per-commit incremental embedding, evaluated against the
recorded baseline rather than adopted on principle.
