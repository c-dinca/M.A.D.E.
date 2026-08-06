# ADR-0017 — Artifacts are content-addressed in an object store, not blobs in Postgres

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** [02-data-model.md](../02-architecture/02-data-model.md), [09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)

## Context

A Run produces Specs, TaskGraphs, Patches, TestReports, ReviewReports, AttemptRecords, raw verification
logs and assembled prompts. Some are small structured documents; verification logs and prompts can be
hundreds of kilobytes. All of them must be retrievable for audit and referenced from events.

Two properties are required. Artifacts must be immutable, because an audit record that can change is
not a record. And they must be referenced from events by a stable identifier that survives storage
changes.

## Decision

Artifacts are content-addressed by `sha256` of their bytes and stored in an S3-compatible object store
(MinIO in the default install). Postgres holds only metadata: digest, kind, schema version, size,
storage location, and the Run and Task that produced it.

Events reference artifacts by digest. Identical content stored twice is one object. Digests are
verified on read, and a mismatch is a loud failure — the artifact is treated as missing, never as
"probably fine".

## Alternatives considered

### Store artifacts as `bytea` or `jsonb` in Postgres — rejected

The strong case, and it is stronger than it first appears. It removes a process from the deployment,
which matters directly against [NFR-021](../01-product/04-non-functional-requirements.md) and would
take the topology from four components to three — a meaningful simplification for a self-hosted
product installed by one person. Artifacts would then commit atomically with their events, so an
event referencing a missing artifact becomes impossible. Backup is one `pg_dump` rather than a
database dump plus an object-store copy, which also makes the restore drill in
[NFR-025](../01-product/04-non-functional-requirements.md) simpler. And `jsonb` would make structured
artifacts queryable.

It lost on backup and WAL behaviour over time. Verification logs and assembled prompts are the bulk of
the volume, they are written on every Attempt, and putting them in Postgres inflates WAL and every
backup with data that is immutable and already content-addressed — turning a small operational
database into a large one, and turning the nightly dump into a job that fails at 3am on a full disk.
Retention pruning also becomes a large delete with vacuum pressure rather than a prefix sweep. The
atomicity argument is real but narrow: the store-then-reference ordering (write the object, then
commit the event) means a crash leaves an orphan object rather than a dangling reference, which is the
harmless direction.

### Plain filesystem paths instead of an object store — rejected

The case: even simpler. No extra process at all, just a directory. For a single-host deployment that
is genuinely sufficient, and it is the smallest possible answer.

Rejected because it makes the second host a migration rather than a configuration change — the moment
sandbox execution or a second worker moves to another machine
([11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md), scaling steps
2 and 3), a local directory stops working. An S3-compatible interface with a local implementation
costs almost nothing today and removes that cliff. Filesystem storage also lacks a natural integrity
check on read, which content addressing gives for free.

## Consequences

### Positive

The operational database stays small, so backups and restores stay fast and the restore drill stays
credible. Immutability and integrity are inherent: the digest *is* the identity, so tampering is
detectable on read. Deduplication is automatic, which matters because identical prompts and identical
failure logs recur constantly. Retention pruning is a prefix sweep. And the storage backend can move
to real S3 or to another host without touching any reference.

### Negative

A fourth process in the deployment, with its own credentials, its own volume and its own failure mode
([NFR-021](../01-product/04-non-functional-requirements.md) is now fully consumed — there is no room
for another). Artifacts do not commit atomically with events, so an orphaned object is possible after
a crash and a cleanup job is needed. Backup is two operations that must be consistent with each other,
which the restore drill has to verify rather than assume. Structured artifacts are not queryable in
SQL, so a question like "which Specs mentioned authentication" requires reading objects rather than a
`jsonb` query. And an object-store outage fails Runs at artifact-write time
([14-integrations.md](../02-architecture/14-integrations.md)).

## Revisit when

Measured artifact volume stays small — under roughly 100 MB per month at design-partner usage — for a
sustained period. At that point collapsing the object store into Postgres would remove a process and
regain atomicity, and the rejected alternative above becomes the better trade.
