# Audit and replay

The mechanism for [UF-5](01-system-overview.md#the-five-unforgivable-failures). Three constituencies
depend on it and they want the same artifact for different reasons: the security reviewer needs to
know what executed and where data could go, the operator needs to debug a bad Run without
reproducing it, and the founder needs a regression corpus that grows on its own.

Design stance: **the event log is the truth; everything else is derived.** Run rows, the ledger and
the viewer are conveniences that must agree with the log. When they disagree, the log is right and the
other thing is a defect.

## The event log

Append-only, ordered by a dense per-Run sequence. The schema is
[`/contracts/schemas/run-event.schema.json`](../../contracts/schemas/run-event.schema.json) and the
table is defined in [`/contracts/db/0001_init.sql`](../../contracts/db/0001_init.sql).

Every event carries the Run, the sequence number, the timestamp, the kind, the State it occurred in,
the optional Task and Attempt, an optional artifact digest, the cost it incurred, and a small
structured payload. Large material — logs, patches, prompts — lives in the object store and is
referenced by digest, so an event stays small enough to append inside the latency budget
([NFR-017](../01-product/04-non-functional-requirements.md)) and the log stays cheap to scan.

### Event kinds

| Kind | Emitted when | Carries |
| --- | --- | --- |
| `run_created` | Run accepted | Request digest, base commit, ceiling, config version |
| `state_entered` | Every State transition | From-State, to-State, the guard that permitted it |
| `artifact_produced` | An agent output validates | Kind, digest, schema version |
| `patch_applied` / `patch_rejected` | Patch application | Digest, files, line counts, or the rejection reason |
| `exec_started` / `exec_completed` | Every Sandbox process | argv, cwd, exit code, duration, output digest |
| `llm_call` | Every model call | Tier, provider, model, tokens, cached tokens, cost, latency, prompt version |
| `verification_completed` | `VERIFY` finishes | Command, exit code, failure signature, failing count |
| `review_completed` | Reviewer output | Verdict, finding count |
| `guard_tripped` | A guard refuses | Guard id, inputs that triggered it |
| `budget_denied` | Admission refuses | Ceiling, spent, estimate |
| `egress_decision` | A network decision on the Run's behalf | Destination, allowed or denied, reason |
| `sandbox_created` / `sandbox_destroyed` | Sandbox lifecycle | Image digest, limits, reason for destruction |
| `human_signal` | Approval or cancellation | Actor, decision, artifact digests shown |
| `run_finished` | Terminal State | Outcome, reason, total spend, duration |

Two completeness requirements make the log worth trusting. **Every Sandbox execution and every model
call has an event** ([NFR-015](../01-product/04-non-functional-requirements.md)), verified nightly by
reconciling `sandbox_execs` and `llm_calls` against `run_events` and asserting zero orphans. And
**every event is written in the same transaction as the effect it records**, so the two cannot
diverge. An effect that cannot be logged does not happen: if the append fails, the effect is not
performed.

That last rule has a cost worth stating plainly. Postgres being unavailable stops all execution
([01-system-overview.md](01-system-overview.md#failure-modes-and-responses)). We accept a hard
dependency and a full stop over the alternative of continuing with an incomplete audit trail, because
an audit trail with gaps is worse than an outage — the outage is visible, the gap is not.

## Deriving state by folding

```
state = fold(decide_effect_free, initial_state, events)
```

Folding must reproduce the recorded final State, spend and Task outcomes exactly, for every Run in the
replay corpus ([NFR-016](../01-product/04-non-functional-requirements.md)). Three rules make that
achievable:

**No wall-clock reads in the fold.** Time-derived facts, including TTL expiry, arrive as events. A
fold that calls `now()` produces a different answer on Tuesday than it did on Monday.

**No randomness and no external lookups.** Anything a fold needs is in the event.

**Additive event evolution.** New event kinds may be added; existing kinds may gain optional fields.
Removing a field or changing a kind's meaning breaks historical folds, so it requires an event schema
version bump and a fold that handles both.

The replay corpus is not synthetic. It is at least twenty recorded real Runs including at least five
failures, committed as fixtures, and it grows whenever a production Run surprises us. This is the
mechanism that turns an incident into a permanent test.

## Crash recovery and exactly-once effects

Every effect carries `sha256(run_id, task_id, attempt_no, state, effect_index)`. Effects are recorded
before they are performed and reconciled after:

```
1. INSERT effect row (status = pending, idempotency_key unique)
2. perform the effect
3. UPDATE to completed + APPEND the event   -- one transaction
```

A crash between 1 and 3 leaves a `pending` row, which recovery handles by class rather than
uniformly, because the safe direction differs:

| Effect | Pending row on recovery | Why |
| --- | --- | --- |
| Model call | Counted as spent, flagged `unconfirmed`, State retried | The provider may have charged us. Assuming it did not permits double spend on every crash |
| Sandbox exec | Re-executed | Executions are idempotent by construction: the same argv against the same tree gives the same result, and re-running costs seconds |
| Patch application | Checked against the workspace tree hash, applied only if absent | Applying twice would corrupt the file |
| Git push | Checked against the remote before retrying | Pushing twice is harmless but a duplicate event is not |

Recovery itself emits an event, so the log shows that a crash happened. A recovery that leaves no
trace makes the subsequent audit confusing in exactly the case where the auditor is most alert.

## Audit export

`GET /v1/runs/{id}/audit` returns newline-delimited JSON: one event per line, ascending by sequence,
conforming to the published schema ([FR-065](../01-product/03-functional-requirements.md)). It is
deliberately a flat stream rather than a report — a reviewer wants to grep it, load it into their own
tooling, and keep it. A rendered PDF would be a worse artifact for the person who actually reads it.

The export answers, without needing us: every command executed with its exit code; every model call
with destination, token counts and cost; every network decision; every human approval with the actor
and what they were shown; the image digest and configuration version the Run executed under.

Redaction runs before persistence, not before export
([FR-066](../01-product/03-functional-requirements.md)). Redacting at export means the secret is in
the database, and the database is what gets backed up, replicated and eventually copied to a laptop.

## Replaying routing against history

The debugging tool that makes a fix provable: take a historical event stream, run it through the
*current* routing functions, and compare the decisions to what happened.

Because routing predicates are pure ([05-orchestration-and-termination.md](05-orchestration-and-termination.md)),
this needs no database, no Sandbox and no model. Its use is specific and worth spelling out: when a
Run loops or escalates wrongly, add the stream as a fixture, assert the current (wrong) behaviour, fix
the predicate, and watch the assertion flip. The regression is then permanent. This is the single most
valuable debugging affordance in the system, and it exists only because of the purity constraint —
which is why that constraint is enforced rather than encouraged.

## Retention

Default 90 days for events, artifacts and Sandbox execution records, configurable per deployment; the
replay corpus is exempt because it is committed as fixtures. Retention is a deletion job over a tenant-
free single-tenant store, so it is a date-bounded delete plus an object-store prefix sweep.

> **Open question OQ-02** — Whether any first customer has a contractual or regulatory retention
> requirement (a minimum retention for audit records, or a maximum for source-derived data), and
> whether data residency is constrained. **Blocks:** the default retention value shipped in
> configuration and any retention claim in customer-facing material. Does not block implementation:
> retention is a configured number with a documented default. **Resolved by:** the founder confirming
> the compliance obligations of the first design partner.

## What is deliberately not built

**No log mutation path.** No edit, no delete, no "correct this event". Corrections are new events that
reference the earlier sequence number. An editable audit log is not an audit log.

**No separate audit database.** A second store would need to agree with the first, and two stores that
must agree eventually do not. The event log serves both purposes.

**No log shipping to an external SIEM in v1.** The customer's security team can consume the export.
Building an outbound integration adds an egress path to defend
([13-security-and-compliance.md](13-security-and-compliance.md)) for a customer we do not have yet;
the seam is noted in [15-future-phase-seams.md](15-future-phase-seams.md).

**No sampling.** Every event is recorded. Sampling makes the log statistically useful and forensically
worthless, and forensic use is the requirement.
