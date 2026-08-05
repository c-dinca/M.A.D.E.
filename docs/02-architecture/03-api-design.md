# API design

The normative interface is [`/contracts/openapi.yaml`](../../contracts/openapi.yaml). This document
gives the conventions behind it and the reasoning a generated client cannot carry. Where prose and the
OpenAPI document disagree, the contract wins.

The API has one job: let an operator or a developer start Runs, watch them, approve them and audit
them. It is not a general-purpose agent API, and the restrictions below are what keep it from
becoming one.

## Conventions

**Base path and versioning.** Everything is under `/v1`. The version increments only for a breaking
change, defined as removing a field, narrowing a type, adding a required request field, or changing
the meaning of an existing value. Additive changes — new optional fields, new enum members in
*response* position, new endpoints — ship without a version bump. Clients MUST ignore unknown response
fields; that requirement is what makes additive change safe.

Enum values in *request* position are closed: an unrecognised value is rejected rather than
defaulted, because silently coercing an unknown `kind` or `decision` is a correctness failure in a
system whose whole premise is not guessing.

**Resource naming.** Plural nouns, lowercase, hyphen-free: `/projects`, `/runs`,
`/runs/{run_id}/events`, `/runs/{run_id}/approvals`. Identifiers are UUIDv7 rendered as strings —
time-ordered so that listing by id is stable and index locality is reasonable.

**Field naming.** `snake_case`, matching the database and the glossary. Money fields carry the
currency in the name (`cost_usd`), because an unlabelled money field is how a currency bug enters a
ledger. Timestamps are RFC 3339 in UTC with a `_at` suffix. Durations are integers with a unit suffix
(`timeout_s`, `latency_ms`) — never a bare number.

**Vocabulary.** Field names use the glossary's terms
([00-context/03-glossary.md](../00-context/03-glossary.md)). `run`, not `job`. `verification`, not
`test run`. `sandbox`, not `container`. This is enforced in review and by a spec-lint check against
the banned-synonym list.

## Authentication and authorisation

A bearer API key per caller, hashed at rest, mapped to one of three roles. Roles exist even though v1
is single-tenant because the personas have genuinely different needs and the security reviewer must
be able to read the audit without holding a key that can start Runs.

| Role | Can |
| --- | --- |
| `operator` | Everything: projects, runs, approvals, audit, cancellation |
| `submitter` | Create Runs on existing Projects, read their own Runs, submit approvals |
| `auditor` | Read Runs, events and audit exports. No writes, no Run creation |

Keys are presented as `Authorization: Bearer <key>`. There is no cookie session, no OAuth flow and no
refresh token, because there is no browser login: the run viewer is served to an operator behind
their own network boundary and authenticates with the same key.

## Errors

One error shape everywhere:

```json
{
  "error": {
    "code": "budget_exceeded",
    "message": "Run budget ceiling of 2.00 USD would be exceeded by the next model call.",
    "details": {"ceiling_usd": "2.00", "spent_usd": "1.97", "estimate_usd": "0.08"},
    "run_id": "0192f3c1-...",
    "request_id": "01J8Z..."
  }
}
```

`code` is a stable machine-readable string and is the field clients branch on; `message` is for a
human and may change. The full catalogue lives in the OpenAPI document. HTTP status carries the
class, `code` carries the meaning:

| Status | Used for | Example codes |
| --- | --- | --- |
| 400 | Malformed or semantically invalid request | `invalid_request`, `unsupported_base_ref` |
| 401 / 403 | Missing or insufficient credentials | `unauthenticated`, `forbidden_role` |
| 404 | Unknown resource, or one the caller may not see | `run_not_found`, `project_not_found` |
| 409 | State conflict: the resource cannot accept this now | `invalid_state_transition`, `idempotency_key_conflict`, `run_already_terminal` |
| 422 | Well-formed but rejected by policy | `policy_violation`, `default_branch_forbidden`, `baseline_verification_failed` |
| 429 | Concurrency or rate limit reached | `too_many_runs` |
| 503 | A dependency the request needs is unavailable | `sandbox_runtime_unavailable`, `provider_unavailable`, `storage_unavailable` |

Two rules follow from the honest-failure principle
([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)). A degraded
dependency MUST surface as an error naming the dependency, never as an empty successful response. And
an operation that was queued rather than performed MUST NOT return 200 with a success body; Run
creation returns 202 with a Run in `INTAKE`, and the client learns the outcome by polling.

## Idempotency

`POST /v1/runs` requires an `Idempotency-Key` header. The key is stored with the created Run and
scoped to the Project. A repeat with the same key returns the original Run and status 200 rather than
201. A repeat with the same key but a materially different body is a 409 `idempotency_key_conflict` —
returning the original silently would hide a client bug, and creating a second Run would double-spend.

`POST /v1/runs/{id}/approvals` is idempotent on `(run_id, awaiting_state, decision)`: submitting the
same decision twice records one approval. This matters because approval links get clicked twice.

Internal effects (model calls, patch application, git writes) carry their own idempotency keys derived
from `(run_id, task_id, attempt_no, state, effect_index)`; that mechanism is described in
[09-audit-and-replay.md](09-audit-and-replay.md) and is what makes
[FR-017](../01-product/03-functional-requirements.md) achievable.

## Pagination

Cursor-based, never offset. `GET /v1/runs/{id}/events?after_seq=N&limit=M` returns events with
`seq > N` in ascending order plus `next_after_seq`. The reason is specific:
`run_events` is append-only and grows while a client reads it, so an offset-based page 2 silently
skips rows inserted since page 1 — and in an audit system a silently skipped row is a defect, not an
inconvenience.

List endpoints for Projects and Runs use the same shape keyed on the UUIDv7 identifier. `limit`
defaults to 50 and is capped at 200.

## Streaming and long-running work

There is no streaming endpoint in v1. Runs take minutes and the surfaces that consume them are a
polling CLI and a server-rendered page that refreshes. Adding server-sent events would introduce
connection lifecycle handling and a second delivery path for the same data, for a user experience
nobody has asked for. The event log with `after_seq` is a strictly better polling primitive than most
streaming APIs offer, because a client that disconnects resumes exactly where it stopped.

## What the API deliberately does not do

**No endpoint executes anything on demand.** There is no "run this command in the sandbox", no "call
this model", no "apply this patch". Every execution is a consequence of a Run advancing through its
state machine. An arbitrary-exec endpoint would be a complete bypass of the state machine, the budget
and the audit trail, and would turn the product into a remote code execution service with a nice UI.

**No endpoint mutates history.** Events, artifacts, attempts and approvals have no update or delete
route. There is no "fix this event" affordance, because the value of the log is that it cannot be
edited.

**No endpoint returns secret material.** Repository credentials and model API keys are write-only:
they are set by name from the host secret store and never read back, including to the `operator` role.

**No endpoint changes a Task's verification command.** It is fixed at plan acceptance
([FR-034](../01-product/03-functional-requirements.md)). Allowing an edit would let a caller — or a
compromised agent with a stolen key — redefine success after the fact, which defeats UF-3 entirely.

**No admin override to force a state transition.** The only human inputs are approval decisions and
cancellation. A "force to DONE" affordance would make every state guarantee conditional on nobody
using it, and it would appear in the audit log as an unexplainable jump.

**No webhooks in v1.** They would require outbound calls from the control plane to customer-configured
URLs, which is a new egress surface to defend for a convenience the polling client already covers.
The seam is noted in [15-future-phase-seams.md](15-future-phase-seams.md).

**No bulk endpoints.** No "create ten runs", no "approve all". Each Run is a spend decision and a
security decision; batching them makes the expensive path the easy one.

## Rate and concurrency limits

Per-deployment concurrent-Run limit (default 4, matching the Sandbox capacity assumption in
[01-system-overview.md](01-system-overview.md#scale-envelope)); exceeding it returns 429
`too_many_runs` rather than queueing, because an invisible queue makes cost and latency unpredictable
and violates the honest-failure principle. The client decides whether to wait.

There is no per-key request rate limit in v1: the callers are a handful of trusted internal clients on
a private network, and a limiter would be a moving part with no attacker to stop.
