# Contracts — normative

Everything in this directory is **normative**. Where a prose document and a contract disagree, the
contract wins and the prose is a defect to be fixed
([ADR-0018](../docs/03-adr/0018-spec-as-contract-and-spec-lint.md)).

| File | Defines | Consumed by |
| --- | --- | --- |
| [`state-machine.json`](state-machine.json) | States, transitions, guards, per-State tool authority, event kinds, Task kinds, await reasons | `made/orchestrator/`, the `CHECK` constraint in the DDL, `spec-lint` |
| [`openapi.yaml`](openapi.yaml) | The HTTP control API and its error catalogue | `made/api/`, the CLI, contract tests |
| [`db/0001_init.sql`](db/0001_init.sql) | The initial database schema, constraints and indexes | `made/store/`, migrations |
| [`schemas/`](schemas/) | Artifact and event payload schemas (JSON Schema 2020-12) | `made/artifacts/`, agents, audit export |

## Rules

**Contract changes land alone and first.** A pull request touching this directory contains only that
change plus its schema tests. Consumers follow as separate backlog items. This is what allows several
agents to implement against one interface concurrently
([04-engineering/05-git-and-review-workflow.md](../docs/04-engineering/05-git-and-review-workflow.md)).

**Additive changes are safe; anything else is a version bump.** Adding an optional field, a new
endpoint, or a new enum member in *response* position is additive. Removing a field, narrowing a type,
adding a required request field, or changing the meaning of a value is breaking and requires `/v2`
([02-architecture/03-api-design.md](../docs/02-architecture/03-api-design.md)). Enum values in
*request* position are closed: an unrecognised value is rejected, never defaulted.

**Every artifact schema carries `schema_version`.** A consumer reading an artifact with an unknown
major version must fail loudly rather than proceed on a partial understanding.

**Consistency is machine-checked.** `spec-lint` asserts that every schema parses, that state names
agree across `state-machine.json`, the DDL, the prose and the implementation, that every internal link
resolves, and that no banned synonym appears in a field name
([00-context/03-glossary.md](../docs/00-context/03-glossary.md#banned-synonyms)).

## Identifiers and formats

| Concept | Format |
| --- | --- |
| Identifiers (`run_id`, `task_id`, …) | UUIDv7 rendered as a lowercase hyphenated string |
| Content digests | Lowercase hex `sha256`, 64 characters |
| Timestamps | RFC 3339, UTC, field suffixed `_at` |
| Money | Decimal string, never a float, field suffixed `_usd` |
| Durations | Integer with a unit suffix: `_s`, `_ms` |
| States, guard ids | `UPPER_SNAKE_CASE` |
| Event kinds, Task kinds, reasons | `lower_snake_case` |

Money is a **string** in JSON rather than a number. JSON numbers are IEEE 754 doubles in most parsers,
and a ledger that must not exceed a ceiling
([NFR-009](../docs/01-product/04-non-functional-requirements.md)) cannot be carried in a type that
loses cents.

## Not defined here

No contract exists for the `SandboxProvider` interface, the toolbelt signatures or the agent protocol.
Those are internal Python protocols, not wire formats; they are specified in
[02-architecture/04-execution-isolation.md](../docs/02-architecture/04-execution-isolation.md) and
[02-architecture/08-context-and-retrieval.md](../docs/02-architecture/08-context-and-retrieval.md) and
enforced by type checking. Publishing them as schemas would imply a stability promise to an external
consumer that does not exist.
