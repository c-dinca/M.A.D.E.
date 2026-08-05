# ADR-0003 — PostgreSQL is the single system of record, including the checkpointer

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-2, UF-5, [02-data-model.md](../02-architecture/02-data-model.md)

## Context

Three kinds of state need durability: the append-only event log that is the audit truth, the cost
ledger that must never disagree with it, and the graph executor's checkpoints that make a Run
resumable. The critical requirement is transactional: an effect that spends money must be recorded in
the same transaction as its event, or the ledger and the audit trail can diverge — and a divergence
between them is a UF-5 failure that nobody notices until an auditor asks.

The intake reports checkpointer throughput figures favouring SQLite over PostgreSQL by roughly seven
times. Those numbers arrive without benchmark conditions and are recorded as unverified
([00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified)).
They are also not decisive at either value: this system's checkpoint rate is a few writes per second
per Run at a concurrency of four, which is two to three orders of magnitude below the lower figure.
Throughput is not the constraint; transactional integrity is.

## Decision

PostgreSQL 16 is the single database. It holds the event log, derived Run state, the cost ledger, the
Sandbox execution records and the LangGraph checkpoints, all in one instance and one transactional
domain.

There is no second datastore. No Redis, no message broker, no separate audit database. Work claiming
uses `SELECT … FOR UPDATE SKIP LOCKED` and Run leases use a row lock on `run_cursor`.

## Alternatives considered

### SQLite — rejected

The strong case is real and would have been chosen for a smaller system: zero operational surface, no
process, no connection pool, no backup daemon — one file that is trivially copied, which for a
self-hosted product installed by a non-specialist is genuinely valuable. The intake's throughput
figures favour it. A single-writer workload with four concurrent Runs is well within its capability,
and WAL mode makes concurrent readers fine.

It lost on the operational lifecycle rather than on performance. Backup and restore of a live database
under concurrent writers is materially harder to do correctly with a file than with `pg_dump`, and
[NFR-025](../01-product/04-non-functional-requirements.md) requires a tested restore drill. Concurrent
writers from multiple worker processes — the first scaling step in
[11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md) — mean writer
contention that Postgres handles natively and SQLite serialises. And `NUMERIC` for money, partial
indexes, and `SKIP LOCKED` are used throughout the schema; reimplementing the ledger on SQLite's type
affinities is exactly the kind of subtle correctness risk this system cannot take with cost data.

### Postgres for the event log plus SQLite or Redis for checkpoints — rejected

The case: checkpoints are hot, ephemeral and not audit material, so putting them in a faster store
matches their access pattern and removes write pressure from the audit table.

Rejected because resuming a Run then requires a consistent view across two stores with no shared
transaction, so a crash between the checkpoint write and the event append leaves them disagreeing —
and the resulting bug is a Run that resumes into a state the log does not explain, which is the worst
possible failure for UF-5. It also breaches the four-process ceiling
([NFR-021](../01-product/04-non-functional-requirements.md)) for a performance problem that
measurement says does not exist.

## Consequences

### Positive

Cost, events and execution position commit atomically, so INV-3 and INV-8
([02-data-model.md](../02-architecture/02-data-model.md)) are enforceable rather than aspirational.
One backup, one restore drill, one set of credentials. Reconciliation queries are ordinary SQL, which
is what makes the nightly invariant checks cheap to write and therefore likely to exist.

### Negative

The operator must run and maintain a database process, which raises the installation bar for a
self-hosted product — a real cost against the 30-minute bootstrap budget in
[NFR-020](../01-product/04-non-functional-requirements.md). Postgres unavailability stops all
execution, by design ([09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)), which
converts a database blip into a full outage. Every agent must write real SQL for migrations and must
know the schema's constraints rather than relying on an ORM to hide them. And the checkpoint tables
are managed by the framework, so their shape is not ours to control and a framework upgrade can
require a migration we did not author.

## Revisit when

Event append latency exceeds [NFR-017](../01-product/04-non-functional-requirements.md) at the target
concurrency, or the checkpoint tables measurably contend with the event log. The first response is
partitioning `run_events` by month, not a second datastore.
