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

Added by the 2026-09 vision change: `/worksites`, `/worksites/{id}/cycles`,
`/worksites/{id}/events`, `/requests`, `/requests/{id}/events`, `/findings`, `/queue`,
`/effectiveness`, `/entitlements`, `/approval-policies`, `/users`, `/teams`, and the ingress endpoints
under `/ingress/{source}`. **These are not yet in [`/contracts/openapi.yaml`](../../contracts/openapi.yaml),
which is normative** — the contract change lands alone and first
([05-delivery/02-backlog.md](../05-delivery/02-backlog.md)).

**Tenancy is not in the path.** There is no `/tenants/{id}/runs`. The tenant is resolved from the
authenticated principal ([FR-141](../01-product/03-functional-requirements.md)); a tenant in a path or
a header is a tenant the caller chooses.

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
| `operator` | Everything **within one tenant**: projects, runs, worksites, requests, approvals, audit, cancellation, administration |
| `submitter` | Create Runs on permitted Projects, read their own Runs, submit approvals where the policy allows |
| `auditor` | Read Runs, worksites, requests, events and audit exports. No writes, no Run creation, no approvals ([FR-136](../01-product/03-functional-requirements.md)) |
| `requester` | Read **their own** requests and the status of Runs created from them. Nothing else, and no repository access ([FR-113](../01-product/03-functional-requirements.md)) |
| `platform` | **Hosted only.** Administer tenants — create, suspend, set ceilings. MUST NOT read any tenant's source, events, artifacts, findings or audit export, enforced by row-level security rather than a role check ([18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)) |

Every role is tenant-scoped except `platform`, and every principal belongs to exactly one tenant
([FR-145](../01-product/03-functional-requirements.md)).

Service keys are presented as `Authorization: Bearer <key>`, hashed at rest. **Console sessions are a
separate matter and are not settled**: a hosted deployment authenticates console users through a
configured identity provider, a self-hosted one may use local accounts, and which is required is
**OQ-23** ([FR-146](../01-product/03-functional-requirements.md)). Until it is resolved, the
identity-provider path is the required one and local accounts are a bootstrap-only fallback. The
previous statement that "there is no browser login" no longer holds.

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
| 429 | Concurrency or rate limit reached | `too_many_runs`, `request_allowance_exhausted` |
| 503 | A dependency the request needs is unavailable | `sandbox_runtime_unavailable`, `provider_unavailable`, `storage_unavailable` |

Codes added by the vision change, grouped by what they tell the caller: `not_entitled` (403 — the
principal's entitlement does not cover this repository, class or lane);
`repository_access_revoked` and `repository_access_insufficient` (422 — the permission envelope
([19-repository-access.md](19-repository-access.md)); **neither is a 503, because a permission error is
a statement about authority rather than availability and must not look retryable**);
`claim_conflict` (409 — an overlapping worksite claim);
`worksite_ceiling_exceeded` and `worksite_not_progressing` (422);
`lane_mismatch` (422 — an operation valid in one lane attempted in the other);
`approval_policy_would_orphan_scope` (422 — saving it would leave a scope nobody can approve);
`insufficient_data` (200 with an explicit marker rather than an error — a measure with too few
observations is an answer, not a failure ([FR-132](../01-product/03-functional-requirements.md))).

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

**No general outbound webhooks.** Outbound calls to arbitrary customer-configured URLs remain refused:
a new egress surface to defend for a convenience the polling client covers
([15-future-phase-seams.md](15-future-phase-seams.md), Seam 6).

> **Partly reversed.** Chat egress exists, and it is deliberately *not* a webhook: one adapter per
> supported platform, a per-field posting allowlist, an egress decision recorded per post, and
> disableable per deployment ([FR-114](../01-product/03-functional-requirements.md),
> [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). The distinction is that a webhook is a
> URL the customer supplies and we must defend generically; this is a named integration whose payload
> shape we control and can test against a seeded corpus
> ([NFR-036](../01-product/04-non-functional-requirements.md)).

**No bulk endpoints.** No "create ten runs", no "approve all". Each Run is a spend decision and a
security decision; batching them makes the expensive path the easy one. A **worksite** is not an
exception: it is a bounded, declared, ceilinged entity whose Runs are created one at a time by the
driver under admission control, which is the opposite of a bulk endpoint
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)).

**No endpoint the console has and the API does not**
([FR-137](../01-product/03-functional-requirements.md)). The console is a view and a decision surface
over this API with the same role enforcement. A private console endpoint would be an unaudited,
uncontracted surface with the same authority.

**No endpoint resolves an artifact digest across tenants.** Content addressing is per tenant prefix,
which forgoes a genuine storage saving and prevents a digest from being a cross-tenant read primitive
([FR-144](../01-product/03-functional-requirements.md)).

**No endpoint edits a finding.** A finding is `RESOLVED`, `DISMISSED` or `STALE` by a recorded
transition; its body and its `evidence_state` are immutable. An editable finding is an editable claim
about what the system found.

## Rate and concurrency limits

Concurrent-Run limits and spend ceilings apply at four levels — deployment, tenant, project, worksite —
and admission is checked at every level before a Run is created
([FR-119](../01-product/03-functional-requirements.md)).

**A human-submitted request that cannot be admitted returns 429 rather than queueing.** Unchanged, and
for the original reason: an invisible queue makes cost and latency unpredictable, and the caller is
present to decide whether to wait.

> **Partly reversed by the 2026-09 vision change, and the purpose preserved by a different
> mechanism.** Internally generated work — an ingress event, a schedule window, a worksite slice —
> **does** queue, because there is no client to receive the refusal. A pull request opened while the
> deployment is at capacity would otherwise never be reviewed, silently, which is a worse violation of
> the same principle than queueing.
>
> The honest-failure property is preserved by **visibility, not refusal**
> ([FR-117](../01-product/03-functional-requirements.md)): every queued item is a durable row carrying
> its position, its age, the reason it is waiting and its cause; every queue is bounded; a queue at its
> bound sheds work with a recorded reason rather than growing; and `GET /v1/queue` and the console page
> expose all of it. The test of whether the reversal was legitimate is a question the operator must be
> able to answer from the interface: *"why has nothing happened for two hours."* Under the old rule the
> answer was a `429` the caller saw. Under this one it is a queue row with a cause. Under a naive queue
> it would be nothing at all.
>
> Specified in [17-persistence-and-concurrency.md](17-persistence-and-concurrency.md),
> [ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md).

**Ingress endpoints are rate-limited**, and this is the one place a limiter now has an attacker to
stop. They accept a signed inbound trigger, record it, and return
([FR-116](../01-product/03-functional-requirements.md)); an unauthenticated or unsigned delivery is
rejected without a database write. There is still no per-key rate limit on the control API, whose
callers are a handful of trusted clients.

**Requests carry their own allowance.** A requester's per-request and per-period budget is checked
before triage spends anything, and exhausting it returns `request_allowance_exhausted` rather than
queueing ([FR-110](../01-product/03-functional-requirements.md),
[NFR-038](../01-product/04-non-functional-requirements.md)).
