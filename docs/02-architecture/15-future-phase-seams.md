# Future-phase seams

The strategy is staged. This document specifies exactly what to build **now** so that each later phase
is additive, and forbids building the later phase.

> **Instruction to agents: do not implement anything in the "Phase 2" columns below.** If a backlog
> item appears to require one, the item is wrong — stop and report per [`/AGENTS.md`](../../AGENTS.md).
> Building a seam is cheap; building the phase behind it costs the v1 milestone and adds an untested
> surface to the threat model.

A seam is not an abstraction layer built speculatively. Each one below already earns its place in v1 —
`SandboxProvider` exists because the escape suite needs a fake, tier routing exists because cost
control needs it. The seam is the *discipline of not leaking past it*, which is free.

## Seam 1 — Hardware isolation (gVisor → Firecracker)

**Build now:** `SandboxProvider` with exactly six operations
([04-execution-isolation.md](04-execution-isolation.md)). Nothing above it may reference the runtime,
containers, images-as-containers or VMs — the glossary bans those words in identifiers for this reason.
The escape suite must run against a provider chosen by configuration, not hard-wired.

**Do not build:** microVM lifecycle management, snapshot and restore, TAP networking, guest agents,
rootfs image pipelines.

**Trigger:** a customer requires hardware-level isolation as a condition of purchase, or an escape-suite
finding that a user-space kernel cannot address.

**Test that the seam holds:** a fake provider passes the same interface tests as the real one, and no
module outside `made/sandbox/` imports anything runtime-specific. Enforced by an import-boundary lint
rule ([04-engineering/01-repo-structure.md](../04-engineering/01-repo-structure.md)).

## Seam 2 — Multi-tenancy

**Build now:** every query filters by `project_id` already, because Projects are the configuration
boundary. API keys map to roles. Artifacts are content-addressed under a prefix. Budgets exist at
Project level.

**Do not build:** a `tenants` table, a nullable `tenant_id` column, row-level security, per-tenant
encryption keys, or quota fairness. A nullable tenant column creates the *appearance* of isolation with
no enforcement, which is worse than its absence — a reviewer sees the column and assumes a guarantee
that does not exist.

**Migration when triggered:** add `tenant_id NOT NULL` with a backfill to a single synthetic tenant,
add it to every unique constraint and index, add row-level security policies, and add tenant scoping to
key resolution. This is a substantial migration and it is *supposed* to be, because doing it early
would mean carrying the hardest part of the threat model for zero v1 revenue
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)).

**Trigger:** the second customer wanting a deployment we operate, or one customer needing isolation
between their own teams.

## Seam 3 — Parallel Task execution

**Build now:** the TaskGraph is already a DAG with explicit dependencies, and `TASK_SELECT` already
chooses from ready Tasks — it simply chooses one. Reducers are documented per field
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)).

**Do not build:** fan-out edges, `Send`-style dynamic dispatch, merge-conflict resolution, or parallel
Sandboxes per Task.

**What changes when triggered:** every reducer must be re-examined (only `attempts` and `guard_trips`
are append-reduced today, and that is safe *because* execution is sequential); the workspace needs a
strategy for concurrent patches, most likely a worktree per Task with a merge step; failure attribution
across concurrent Tasks needs design, because "which Task broke the suite" stops being obvious; and
budget admission must become atomic across concurrent claimants.

**Trigger:** measured Run duration dominated by sequential Task execution *and* a golden-suite pass rate
high enough that concurrency is worth the debugging cost. Not before — parallelism multiplies the
difficulty of every other failure and directly threatens
[UF-3](01-system-overview.md#the-five-unforgivable-failures) and
[UF-5](01-system-overview.md#the-five-unforgivable-failures).

## Seam 4 — Greenfield project generation

This is the seam most likely to be built prematurely, because it is the framing the intake's "a-z
software creator" language implies. v1 deliberately excludes it
([01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md)).

**Build now:** nothing specific. The Project abstraction already separates "target repository" from
"Run", and Task kinds already include `iac`.

**Do not build:** project templates, scaffolding agents, or a "create from description" endpoint.

**What must exist first:** a mechanism by which a generated project acquires a *meaningful* oracle. A
scaffold that passes its own generated tests proves nothing, and shipping that would break
[UF-3](01-system-overview.md#the-five-unforgivable-failures) at the level of the product's central
claim. The plausible route is a curated template that ships with a real harness, so the first Run
inherits an oracle it did not write.

**Trigger:** OQ-03 resolved in favour of greenfield *and* a template-with-harness mechanism designed.

## Seam 5 — Model-authored image building

**Build now:** `iac` Tasks and their static validators.

**Do not build:** a build service, a registry integration, or execution of model-authored `RUN` steps.
Building a model-written Dockerfile executes arbitrary code with network access, which is a materially
larger threat model than anything in v1 ([04-execution-isolation.md](04-execution-isolation.md)).

**Trigger:** a customer requires end-to-end validation of generated deployment artifacts, and the
isolation boundary has moved to Seam 1.

## Seam 6 — Notification and SIEM egress

**Build now:** the event log with a sequence cursor, and the audit export
([09-audit-and-replay.md](09-audit-and-replay.md)). Both are pull-based, which means a consumer can
already build anything they need.

**Do not build:** outbound webhooks, log shipping, or a chat integration. Each adds an outbound path
from the control plane to a customer-configured destination, which is a new egress surface to defend
([13-security-and-compliance.md](13-security-and-compliance.md)).

**Trigger:** a customer requiring push delivery into their SIEM as a purchase condition.

## Seam 7 — Cross-Run learning

**Build now:** attempt records within a Run, and the evaluation corpus, which is where genuine learning
accumulates — in tests, not in a hidden store.

**Do not build:** a semantic memory of past solutions, a vector store of prior fixes, or automatic
prompt evolution. Any of these injects an unlogged influence into a Run, which breaks the property that
a Run is explainable from its own event log
([09-audit-and-replay.md](09-audit-and-replay.md)) — and explainability is a v1 gate, not a nice-to-have.

**Trigger:** a design in which retrieved prior knowledge enters the Run as a **logged artifact with a
digest**, so that "why did it do that" remains answerable. That design does not exist yet, and the
absence of it is the reason for the prohibition, not squeamishness about the idea.

## Summary

| Seam | Build now | Forbidden in v1 | Trigger |
| --- | --- | --- | --- |
| 1 Hardware isolation | Six-operation provider interface, configurable | microVM lifecycle, snapshots | Customer requirement or escape finding |
| 2 Multi-tenancy | Project scoping, roles, prefixed artifacts | Tenant table or column, RLS | Second hosted customer |
| 3 Parallel Tasks | DAG with dependencies, documented reducers | Fan-out, dynamic dispatch | Duration dominated by sequencing, at a high pass rate |
| 4 Greenfield | Project abstraction, `iac` kind | Templates, scaffolding agent | OQ-03 plus an oracle mechanism |
| 5 Image building | `iac` static validators | Build service, registry push | Customer requirement plus Seam 1 |
| 6 Notification egress | Pull-based log and export | Webhooks, SIEM push | Customer purchase condition |
| 7 Cross-Run learning | Attempt records, eval corpus | Semantic memory, prompt evolution | A logged-artifact design |
