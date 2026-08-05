# Coding standards

Rules are marked **[lint]** when a tool enforces them and **[review]** when a human or reviewing agent
must. Every rule that is not self-evident carries the failure it prevents, because a rule whose reason
is understood is applied correctly in the cases it did not anticipate — and an agent that understands
why will not route around it.

## Tooling

`ruff` for formatting and linting, `mypy --strict` for types, `pytest` for tests, `pre-commit` to run
all three plus a secret scan before every commit. All are CI gates
([06-ci-cd.md](06-ci-cd.md)). Line length 100.

## Types

**[lint] Every function has annotated parameters and return type.** `mypy --strict`, no `Any` without
a comment naming the reason, no untyped decorators.

**[lint] No bare `dict` or `list` at a module boundary.** Cross-module data is a Pydantic model or a
dataclass. A `dict[str, Any]` crossing a boundary is where a schema violation hides until it reaches a
prompt or the database.

**[review] Money is `Decimal`, never `float`.** Costs are summed across thousands of calls and compared
against a ceiling; binary floating point accumulates error that turns
[NFR-009](../01-product/04-non-functional-requirements.md) into a coin toss. The database column is
`NUMERIC`; keep the Python type consistent with it.

**[review] Identifiers are typed distinctly** — `RunId`, `TaskId`, `ArtifactSha` as `NewType` over
`str`. Passing a `task_id` where a `run_id` belongs is otherwise a silent, plausible bug in a system
whose entities all have string ids.

## Purity where it is load-bearing

**[lint] `orchestrator/routing.py` and `orchestrator/guards.py` may not import IO modules, call
`datetime.now()`, use `random`, or read environment variables.** Enforced by an import-boundary rule
plus a forbidden-call check.

Prevented failure: a router that reads the clock decides differently on replay than it did in
production, which silently breaks [NFR-016](../01-product/04-non-functional-requirements.md) and
destroys the ability to prove a fix against a historical Run
([09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)). Time enters as an event.

**[review] Guards take data, not repositories.** A guard receives the attempt history; it does not
fetch it. Otherwise it cannot be unit-tested without a database, and it will not be.

## Errors

**[review] Every raised exception is a defined type in `made/errors.py` mapping to an API error code.**
A bare `Exception` reaching the API becomes a 500 with no `code`, and a client cannot branch on it
([03-api-design.md](../02-architecture/03-api-design.md)).

**[review] Never catch an exception to continue with a default value.** Prevented failure: defaulting
an unknown cost to zero, or an unknown verification result to "not failed", produces a confident lie —
exactly what the honest-failure principle forbids
([01-system-overview.md](../02-architecture/01-system-overview.md#design-principles-as-tie-breakers)).
Catch to translate, to add context, or to route to a State. Never to hide.

**[lint] No bare `except:` and no `except Exception` without a re-raise or a named translation.**

**[review] A degraded dependency surfaces as an error naming the dependency**, never as an empty
successful result ([14-integrations.md](../02-architecture/14-integrations.md)).

## Database

**[review] Only `made/store/` executes SQL.** Prevented failure: the same-transaction rule for effects
and events is enforceable in one module and unenforceable across twenty.

**[review] Every effect that spends money or executes code is written in the same transaction as its
event.** This is INV-3 and INV-8 ([02-data-model.md](../02-architecture/02-data-model.md)). Two
statements in sequence without a transaction is the bug that makes the ledger and the audit log
disagree, and it will not be noticed until an auditor asks.

**[review] Read current State from `run_cursor`, never from the latest event.** Prevented failure:
events that do not change state (a cost charge, an exec record) make "last event" an intermittently
wrong answer — the worst kind to debug.

**[review] Paginate append-only tables by `seq`, never by `OFFSET`.** Rows inserted between pages make
offset pagination skip records, and a skipped audit record is a defect.

**[lint] No ORM lazy loading and no implicit N+1.** Queries are explicit.

## Concurrency

**[review] One writer per Run, always via the lease.** Two workers advancing one Run produces duplicate
patches and double spend (INV-6).

**[review] Idempotency keys on every effect**, derived from
`(run_id, task_id, attempt_no, state, effect_index)`. Prevented failure: a crash mid-effect causes a
repeat, and without a key the repeat is a second charge
([09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)).

**[review] No `asyncio.create_task` without awaiting it somewhere.** A fire-and-forget task that fails
silently produces work that appears to have happened. If it must be background, it goes through the
worker with an event.

## Prompts and models

**[lint] No vendor or model name outside `made/llm/providers/`.**
([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md))

**[review] No prompt string built at a call site.** All prompts go through `context/assembler.py`.
Prevented failure: an ad-hoc prompt bypasses the token budget
([NFR-014](../01-product/04-non-functional-requirements.md)) and the cache prefix ordering, and the
second failure is invisible until the bill arrives
([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)).

**[review] Nothing variable enters the stable prefix.** No timestamp, no run id, no set iteration
whose order is not fixed. Sort anything derived from a set before rendering.

**[review] Every model output is schema-validated before use**, with one repair retry and then failure
([FR-052](../01-product/03-functional-requirements.md)).

## Sandbox

**[review] `exec` takes an argument vector, never a command string.** Prevented failure: a string
interface invites interpolation, and the first filename containing a quote executes something nobody
wrote.

**[review] Every path from an agent is resolved and validated against the workspace root after symlink
resolution, host-side.** A symlink planted by the agent is an expected attempt
([04-execution-isolation.md](../02-architecture/04-execution-isolation.md)).

**[review] Never add a capability to the sandbox to make something work.** If a workload needs a
capability the Sandbox lacks, that is an ADR, not a configuration change.

## Logging

**[lint] Structured logging only; no bare `print`.**

**[review] Every log line carries `run_id` where one exists.**

**[review] Never log a secret, a full prompt, or a completion body**
([12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md)). Redaction happens
before persistence, not at read time — redacting at export means the secret is in the database, and
the database gets backed up.

## Testing

**[review] Every `FR-###` and `NFR-###` has a test carrying its marker.** `spec-lint` fails on an
unreferenced requirement ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).

**[review] Never weaken a test to make it pass.** Loosening an assertion, adding a tolerance, or
skipping a case is a scope reduction disguised as a fix. If a test is wrong, say so in the pull
request and change it deliberately with the reason.

**[review] No sleeps in tests.** Poll a condition with a timeout; a sleep is either flaky or slow, and
usually both.

## Anti-patterns

Ranked by how much damage they do here, not by how often they occur generally.

| Anti-pattern | Consequence | Caught by |
| --- | --- | --- |
| Reading the clock or a database inside a routing predicate | Replay diverges from production; [NFR-016](../01-product/04-non-functional-requirements.md) fails and fixes become unprovable | Lint, replay suite |
| Fuzzy-matching a patch to make it apply | Silent file corruption that may pass verification — the exact UF-3 failure ([ADR-0008](../03-adr/0008-search-replace-patch-format.md)) | Review, unit tests |
| Catching an exception and defaulting a value | A confident lie: unknown rendered as zero or as success | Review |
| Building a prompt string at a call site | Token budget and cache prefix bypassed; cost regression invisible in behaviour | Review, cache-ratio metric |
| Adding a fallback to a weaker sandbox runtime | The product's central claim becomes false while every test still passes | Review, escape suite |
| Letting a model choose the verification command or its arguments | Success becomes redefinable by the thing being verified ([ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md)) | Review, contract tests |
| A second implementation of failure normalisation | The progress oracle and the prompt drift apart; retries stop being refused correctly ([ADR-0010](../03-adr/0010-termination-guards.md)) | Lint (single-definition check), review |
| Writing an effect without its event | Silent audit gap; [NFR-015](../01-product/04-non-functional-requirements.md) fails at the nightly reconciliation, long after the change | Review, nightly reconciliation |
| Raising an attempt cap or budget to get a Run to finish | Removes the bound that UF-2 depends on; caps are configuration, not code | Review |
| Using a banned synonym in an identifier | Vocabulary drift makes the log, the schema and the API describe the same thing differently | `spec-lint` |
| Adding a fifth long-running process | Breaks [NFR-021](../01-product/04-non-functional-requirements.md) and the one-operator principle | Contract test on the Compose file |
| Storing file contents in graph state | Every checkpoint carries the codebase, and it leaks into prompts ([ADR-0007](../03-adr/0007-git-worktree-as-project-state.md)) | Review, state schema test |
