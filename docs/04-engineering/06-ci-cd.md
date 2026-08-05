# CI/CD

Every gate exists to prevent a specific failure. A gate whose failure nobody can name should be
deleted, because it only costs time and trains people to ignore red builds.

## Pipeline on every pull request

Ordered cheapest-first, so the common mistake fails in seconds rather than after a Sandbox has booted.

| # | Stage | Prevents | Blocking |
| --- | --- | --- | --- |
| 1 | Secret scan | A committed credential, which is a rotation event rather than a cleanup | Yes |
| 2 | `lint` + `fmt --check` | Style churn in diffs, and the specific lint rules that encode architectural boundaries | Yes |
| 3 | `types` (`mypy --strict`) | Untyped boundaries where a schema violation hides until it reaches a prompt or the database | Yes |
| 4 | `spec-lint` | Specification drift: unparseable contracts, state names disagreeing across contract, DDL and code, broken links, dangling requirement ids, banned synonyms, orphaned open questions ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)) | Yes |
| 5 | `unit` | Guard, routing, normaliser, patch-parser and assembler defects | Yes |
| 6 | `contract` | An implementation diverging from a published schema or from the OpenAPI document | Yes |
| 7 | `replay` | A fold or recovery regression, which would silently break auditability ([NFR-016](../01-product/04-non-functional-requirements.md)) | Yes |
| 8 | Import-boundary check | A routing predicate gaining IO, a vendor name escaping the provider package, a sandbox detail leaking upward | Yes |
| 9 | Dependency vulnerability scan | Known-vulnerable transitive dependencies in a security-positioned product | Yes for high and critical |
| 10 | `escape` (fast subset) | An isolation regression reaching `main` ([NFR-002](../01-product/04-non-functional-requirements.md)) | Yes |
| 11 | `test-int` | End-to-end breakage against real Postgres and a real Sandbox | Yes |
| 12 | Coverage floors | Under-tested guard, normaliser or patch code ([04-testing-strategy.md](04-testing-strategy.md)) | Yes |
| 13 | `eval-compare` | A prompt, tier or retrieval change that degrades outcomes or raises cost ([NFR-027](../01-product/04-non-functional-requirements.md)) | Yes, when prompts, tiers or retrieval are touched |

Stage 13 is conditional because a full evaluation run costs real money and takes minutes. It is
triggered by paths: any change under `made/agents/prompts/`, `made/context/`, `made/llm/`, or a tier
change in configuration.

## Nightly

| Job | Purpose |
| --- | --- |
| `escape` (full) | Every case, including the slow ones, against the real runtime and current pinned image |
| `eval` (full) | All golden tiers, three repetitions each, written as a candidate baseline |
| Invariant queries | INV-1 through INV-9 against the staging database ([02-data-model.md](../02-architecture/02-data-model.md)) |
| Audit reconciliation | Orphan model calls or Sandbox executions, and spend mismatches ([NFR-015](../01-product/04-non-functional-requirements.md)) |
| Benchmarks | Sandbox create-to-ready, event append latency, API latency; results committed to `bench/` |
| Bootstrap timing | Clean VM to passing smoke test, against [NFR-020](../01-product/04-non-functional-requirements.md) |
| Image freshness | Age of the pinned sandbox image and outstanding runtime advisories ([NFR-004](../01-product/04-non-functional-requirements.md)) |

Nightly failures for `escape` and reconciliation page immediately (alerts 1 and 2 in
[12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)). The rest open an
issue.

## Migration safety

Migrations are forward-only, numbered, and applied before the new code starts. The deploy sequence is
migrate → restart worker → restart API, and there is a window in which the previous version runs
against the new schema. Every migration must survive that window.

Checked in CI:

| Check | Prevents |
| --- | --- |
| Migration applies to a database seeded at the previous release | A migration that only works on an empty schema |
| Previous release's test suite passes against the migrated schema | Breaking the running version during the deploy window |
| No `DROP COLUMN`, `DROP TABLE` or in-place `RENAME` in a migration whose column is still written by the previous release | The classic deploy-window outage. Renames are add, backfill, switch, drop-in-a-later-release |
| No `UPDATE` or `DELETE` grant on `run_events` | INV-1: the log stays append-only |
| Every new table has a primary key and the required indexes from [02-data-model.md](../02-architecture/02-data-model.md) | Sequential scans on the hot path |

## Release

Tag on `main`, build one application image, publish with a digest, and publish the accompanying
sandbox image digest separately — the two version independently
([11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)). Release notes
are generated from squashed commit subjects and their `Refs:` footers, which is the second reason
those footers are mandatory.

A release is blocked by any failing escape case, any failing invariant, or an unreviewed contract
change. Nothing else blocks a release, including an evaluation regression that is explicitly
acknowledged in the pull request — because sometimes a deliberate trade is correct, and the record of
it is the acknowledgement.

## Rollback

Restart the previous application image tag. Safe across one release because of the additive-migration
rule; across two it requires a restore, and that is documented rather than pretended otherwise. Runs
in flight park and resume ([NFR-019](../01-product/04-non-functional-requirements.md)).

A rollback does not roll back a Project's sandbox image, which is pinned separately. The Run record's
stored image digest is what keeps an older Run explainable after either has moved
([FR-060](../01-product/03-functional-requirements.md)).

## What CI deliberately does not do

**No automatic deployment to a customer.** They are self-hosted and upgrade on their own schedule
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)). Anything else would be pushing code onto
someone else's infrastructure without their consent, which is precisely what our own buyers fear.

**No evaluation on every commit.** Real money and minutes, for a signal that is statistical and does
not change commit to commit.

**No flaky-test quarantine.** A quarantined test is an untested requirement, and in the escape suite it
would be an accepted escape. Fix it or delete it deliberately with a reason.

**No performance gate on unit tests.** Budgets are measured in dedicated benchmarks with committed
results, not asserted inline where a loaded runner makes them flaky.
