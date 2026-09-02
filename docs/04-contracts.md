# Contracts

Everything in [`/contracts/`](../contracts/) is **normative**. Where a document and a contract
disagree, the contract wins and the document is a defect to be fixed
([ADR-0018](03-adr/0018-spec-as-contract-and-spec-lint.md)).

| File | Defines |
| --- | --- |
| [`state-machine.json`](../contracts/state-machine.json) | States, transitions, guards, per-state tool authority, event kinds |
| [`openapi.yaml`](../contracts/openapi.yaml) | The HTTP API and its error catalogue |
| [`db/0001_init.sql`](../contracts/db/0001_init.sql) | The database schema, constraints and indexes |
| [`schemas/`](../contracts/schemas/) | Artifact and event payload schemas (JSON Schema 2020-12) |

## The contracts are ahead of nothing and behind the cut

**The contracts currently describe a larger product than v1.** They were written for the previous
scope and then the specification was cut to one verified lane and one judgement lane
([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)). They also predate three decisions
that change them: one instance per client rather than shared tenancy
([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)), container isolation with an egress
allowlist ([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md)), and optimistic
concurrency ([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)).

Under the source-of-truth rule that makes the **documents** correct and the contracts stale, which is
the opposite of the usual direction and needs saying plainly: an agent implementing from
[`/contracts/`](../contracts/) today would build the wrong product.

`CON-01` to `CON-06` below fix that. They are **hard blockers**, not paperwork: no implementation item
touching an entity they cover is startable until the relevant one has merged.

## Rules

**Contract changes land alone and first.** A pull request touching [`/contracts/`](../contracts/)
contains only that change plus its schema tests. That is what lets consumers be implemented against a
settled interface.

**Additive changes are safe; anything else is a version bump.** Adding an optional field, a new
endpoint, or a new enum member in *response* position is additive. Removing a field, narrowing a type,
adding a required request field, or changing the meaning of a value is breaking. Enum values in
*request* position are closed: an unrecognised value is rejected, never defaulted.

**Event evolution is additive only.** A new event kind may be added and an existing kind may gain an
optional field. Removing a field or changing a kind's meaning breaks the ability to fold a historical
Prompt Book, which is the property [FR-062](03-requirements.md) exists to protect.

**Every artifact schema carries `schema_version`.** A consumer reading an unknown major version fails
loudly rather than proceeding on a partial understanding.

## Identifiers and formats

| Concept | Format |
| --- | --- |
| Identifiers (`house_id`, `scene_id`, …) | UUIDv7 as a lowercase hyphenated string |
| Content digests | Lowercase hex `sha256`, 64 characters |
| Timestamps | RFC 3339, UTC, field suffixed `_at` |
| Money | **Decimal string, never a float**, field suffixed `_usd` |
| Durations | Integer with a unit suffix: `_s`, `_ms` |
| States, guard ids | `UPPER_SNAKE_CASE` |
| Event kinds | `lower_snake_case` |

Money is a string in JSON because JSON numbers are IEEE 754 doubles in most parsers, and a ledger that
must not exceed a ceiling ([NFR-009](03-requirements.md)) cannot be carried in a type that loses cents.

**Field names use the Scenio vocabulary** ([01-product.md](01-product.md)): `house` not `project` or
`repo`, `scene` not `run` or `job`, `preview` not `pr`, `prompt_book_entry` not `log`. A synonym is a
review-blocking defect — an agent debugging a failure must be able to see that a log line, a database
row and an API response describe the same thing without inferring it.

---

## CON-01 — Remove tenancy; one instance per client

**Blocks:** every other contract item, and every implementation item that touches storage.
**Reading:** [ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md),
[02-architecture.md](02-architecture.md).

The previous contract work assumed a shared runtime and specified `tenant_id NOT NULL` in every unique
constraint and index, with row-level security. One isolated instance per client removes the need for
all of it.

- Remove `tenant_id` from every table, index and constraint. Remove the `tenants` table, row-level
  security policies, and tenant resolution from the authenticated principal.
- Remove the tenant parameter from every API path, header and body — there was none by design, and
  there must be none now for a different reason.
- Remove tenant prefixes from object-store paths, metric labels and log fields.
- **A test MUST assert that no `tenant_id` column, policy or prefix remains.** A half-removed boundary
  is the mirror image of the half-built one ADR-0021 correctly rejected: it implies a separation the
  schema no longer provides.

## CON-02 — The Scene state machine, cut to the v1 loop

**Blocked by:** CON-01. **Blocks:** the Stage Manager.
**Reading:** [02-architecture.md](02-architecture.md),
[ADR-0032](03-adr/0032-three-actors-two-roles.md).

- States for the verified loop only: instantiate, change, Dress Rehearsal, The Call, Preview, and the
  terminal states. Remove the planning states — there is no Architect and no generated plan
  ([FR-081](03-requirements.md)).
- **Rename the states to the Scenio vocabulary**, so that a contract state, a log line and a Booth
  label read the same. `HELD` for a Scene waiting on a person, `DROPPED_CUE` for one that failed.
- Add the judgement-lane states: assess, and its terminal state. **No transition MUST exist from the
  judgement sub-graph into the change step** — an actor that can promote its own output across the
  lane boundary has erased the boundary.
- Per-state tool authority: the Crew's write grant is scoped to the Scene's declared paths, and the
  Prompter's to its own evidence room ([FR-080](03-requirements.md)).
- The machine MUST remain well-formed: no self-loop, no transition out of a terminal state, and every
  state reaching a terminal state.

## CON-03 — Comments and evidence records

**Blocked by:** CON-01. **Blocks:** the Prompter.
**Reading:** [ADR-0023](03-adr/0023-advisory-findings-carry-evidence.md),
[FR-088](03-requirements.md).

- `comments` and `evidence` as **separate tables**. `evidence_state` is a two-valued `CHECK`, and
  `demonstrated` requires a non-null foreign key to an evidence record.
- `evidence_recorded` is a **distinct event kind** from the verification entry. A test MUST assert that
  no evidence record can be referenced by a verification event, and that none satisfies the
  no-false-success invariant ([NFR-018](03-requirements.md)).
- **No `confidence` or score column**, and a test asserting it. A score is a model output;
  `demonstrated` is a recorded exit code. A float invites averaging, and an average confidence has no
  referent.
- Hostile-insert probes: a comment with neither evidence nor an `unverified` label, and a
  `demonstrated` comment with no evidence record, are both rejected by the live schema.

## CON-04 — Prompt Book entries for the v1 loop

**Blocked by:** CON-01. **Blocks:** the Stage Manager, Box Office.
**Reading:** [FR-062](03-requirements.md), [FR-063](03-requirements.md),
[NFR-015](03-requirements.md).

- Entry kinds for what v1 actually does: Scene created, state entered, patch applied or rejected,
  execution started and completed, model call, verification completed, egress decision, Rehearsal Room
  created and destroyed, git operation, re-plan, approval, Scene finished. Remove the kinds belonging
  to deferred capability.
- `re_planned` is a **new** kind and carries the base commit it moved from and the one it moved to, so
  that optimistic concurrency's cost is countable ([NFR-044](03-requirements.md)).
- The application role MUST have **no UPDATE and no DELETE grant** on the table
  ([FR-062](03-requirements.md)). Immutability enforced by a grant rather than by discipline.
- Sequence numbers dense per Scene, so that a gap query detects a lost entry.

## CON-05 — The Rehearsal Room contract

**Blocked by:** CON-01. **Blocks:** the execution provider.
**Reading:** [ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md),
[FR-054](03-requirements.md) to [FR-057](03-requirements.md).

- The provider interface: create, write files, read file, exec, destroy. **`exec` takes an argv
  vector, never a command string** — a string interface invites interpolation, and the first time a
  filename contains a quote the system executes something nobody wrote.
- Resource limits and the per-execution timeout are **required** fields at creation, not optional ones
  with defaults.
- The egress allowlist is a declared field on the recipe, **empty by default**, and the model endpoint
  MUST NOT be expressible in it ([FR-057](03-requirements.md)).
- Remove the image-build-time egress allowlist and the baked-dependency assumption, both of which came
  from the superseded no-network decision
  ([ADR-0006](03-adr/0006-no-network-in-verification-sandbox.md)).

## CON-06 — Box Office queries and the Booth's surface

**Blocked by:** CON-01, CON-02, CON-03, CON-04. **Blocks:** the Booth.
**Reading:** [FR-130](03-requirements.md), [FR-132](03-requirements.md),
[ADR-0028](03-adr/0028-web-console-as-a-product-surface.md).

- The four Box Office queries, **published as part of the contract** rather than hidden in
  application code. A client who disbelieves a figure runs the query.
- Every Box Office response carries the **count** each figure was computed from and an explicit
  window; a figure with too few observations has a distinct representation rather than a zero
  ([FR-132](03-requirements.md)).
- Booth endpoints for the Scene list, Scene detail, The Call and Box Office. **Nothing else** — the
  rest of the page set is deferred ([07-deferred.md](07-deferred.md)).
- **No endpoint executes anything on demand**, forces a transition, mutates a Prompt Book entry or
  performs a bulk approval. A test MUST assert the Booth's route set is a subset of the published API.
- Error codes: a missing or revoked repository permission is **422, not 503**, because a permission
  error is a statement about authority rather than availability and must not look retryable
  ([FR-126](03-requirements.md)).
