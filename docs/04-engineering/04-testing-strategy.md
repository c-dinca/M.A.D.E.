# Testing strategy

The pyramid is deliberately deformed by this project's risk profile. A conventional weighting — many
unit tests, some integration, a few end-to-end — would leave the five unforgivable failures
([01-system-overview.md](../02-architecture/01-system-overview.md#the-five-unforgivable-failures))
covered by the thinnest layer. Two suites here carry weight out of proportion to their size, and one
whole category of behaviour is deliberately not tested for correctness at all.

## Weighting

| Suite | Share of effort | Runs | Covers |
| --- | --- | --- | --- |
| `unit` | ~35% | Every commit | Guards, routing, normaliser, patch parser, prompt assembler, schemas |
| `contract` | ~10% | Every commit | Schemas parse and match implementations; OpenAPI conformance; state-machine consistency |
| `replay` | ~10% | Every commit | Event-fold determinism, crash recovery matrix |
| `integration` | ~20% | Every commit (fast subset), full on merge | Real Postgres, real Sandbox, end-to-end Runs |
| **`escape`** | **~15%** | **Every commit; full nightly** | **The isolation boundary** |
| `eval` | ~10% | Nightly and on demand | Outcome quality, cost, escalation, injection resistance |

`escape` at 15% of testing effort for what is architecturally one module is the clearest signal of the
risk profile. It is justified by UF-1: it is the only suite whose failure stops the product rather
than a build.

## The suites that carry disproportionate weight

### Escape suite — the isolation claim

The full case list is in
[04-execution-isolation.md](../02-architecture/04-execution-isolation.md#escape-test-suite). Rules
that make it meaningful rather than decorative:

**It runs against the real runtime and the real pinned image.** A fake provider proves nothing here. A
suite that passes against a mock is a suite that certifies a mock.

**100% pass, always** ([NFR-002](../01-product/04-non-functional-requirements.md)). No quarantine
list, no known-failures file, no `xfail`. A quarantined escape test is an accepted escape.

**Every incident adds a permanent case.** This is how the suite becomes an asset that a competitor
cannot copy ([00-context/04-business-model.md](../00-context/04-business-model.md)).

**It gates provider changes.** Swapping the isolation runtime (Seam 1) is accepted by this suite
unchanged, which is the test that the provider abstraction did not leak.

### Replay suite — the audit and recovery claim

**Fold determinism.** Folding each Run in the corpus reproduces its recorded final State, spend and
Task outcomes exactly ([NFR-016](../01-product/04-non-functional-requirements.md)).

**The corpus is real, not synthetic.** At least twenty recorded Runs including at least five failures,
committed as fixtures under `tests/fixtures/events/`. Synthetic streams test the fold against our
assumptions; recorded ones test it against what actually happens.

**The crash matrix.** For every non-terminal State, kill the worker in that State, restart, and assert
the Run reaches a terminal State with zero duplicated model charges
([NFR-019](../01-product/04-non-functional-requirements.md)). Every State, not a sample — the states
that are hard to reach are the ones where recovery is wrong.

**Routing replay.** Historical streams run through current routing predicates. This is both a
regression harness and the debugging tool that makes a fix provable
([09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)).

## Coverage floors by area

Line coverage is a weak signal, so floors are set by consequence rather than uniformly. A module below
its floor fails CI.

| Area | Floor | Reason |
| --- | --- | --- |
| `orchestrator/guards.py`, `orchestrator/routing.py` | 100% branch | Pure functions with no dependencies; anything below 100% is laziness, and these decide termination |
| `context/normalise.py` | 100% branch | The progress oracle and the prompt both depend on it ([ADR-0010](../03-adr/0010-termination-guards.md)) |
| `tools/apply_patch.py` and the patch policy validator | 100% branch | Silent corruption and privilege escalation both live here |
| `llm/client.py` admission and metering paths | 95% | [NFR-009](../01-product/04-non-functional-requirements.md) has no error budget |
| `sandbox/` | 90% plus the escape suite | Coverage is secondary to the escape suite here |
| `store/` | 90% | Transaction boundaries are the audit guarantee |
| `api/` | 80% | Contract tests carry more weight than line coverage |
| `agents/` | 60% | Mostly prompt assembly and schema handling; the eval suite is the real measure |
| Overall | 85% | |

## Invariant tests

Some properties are asserted as queries rather than as unit tests, because they must hold across all
data rather than for one case. These run nightly and in the full integration pass, and each maps to an
invariant in [02-data-model.md](../02-architecture/02-data-model.md):

no Run in `DONE` without a zero exit code per Task (INV-2,
[NFR-018](../01-product/04-non-functional-requirements.md)); recorded spend equals the ledger sum
(INV-3); no Task exceeds its attempt cap (INV-4); every model call and Sandbox execution has an event
(INV-8, [NFR-015](../01-product/04-non-functional-requirements.md)); no `sandbox_session` for a
terminal Run lacks `destroyed_at` (INV-7); and no gaps in the event sequence (INV-1).

## Test data

Seed repositories under `tests/fixtures/repos/` are synthetic, small and source-only. `demo-fastapi`
has a passing baseline and a Dockerfile so `iac` Tasks are exercisable. The adversarial repository
contains prompt-injection text in a README, a test docstring and a comment — that content is the test
and must not be tidied.

No customer data, ever ([01-repo-structure.md](01-repo-structure.md)).

Model calls in `unit`, `contract`, `replay` and most `integration` tests use a fake provider returning
recorded completions, so those suites are deterministic, free and offline. Only `eval` calls real
endpoints.

## What is deliberately not tested

**Model output quality in the deterministic suites.** Assertions about what a model produces are flaky
by construction. Quality is measured statistically by the evaluation harness against a baseline
([10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)), not
asserted per test. A unit test asserting that the Developer produces a particular patch is a test that
will be deleted within a month.

**Third-party behaviour.** No tests that a provider's API works, that Postgres commits, or that git
pushes. Test our handling of their failures instead — that is what the degraded-mode tests do.

**The run viewer's appearance.** Its *truthfulness rules* are tested — verification wording, parked
Runs not shown as in progress, unknown not rendered as zero
([06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)) —
because those are product requirements. Layout is not.

**Performance in unit tests.** Budgets are measured in dedicated benchmarks
([NFR-001](../01-product/04-non-functional-requirements.md),
[NFR-017](../01-product/04-non-functional-requirements.md),
[NFR-023](../01-product/04-non-functional-requirements.md)) with committed results, not asserted
inline where they become flaky on a loaded machine.

**Exhaustive language support.** v1 supports one toolchain in the sandbox image
([01-scope-and-personas.md](../01-product/01-scope-and-personas.md)); testing a matrix of languages
would test scope we do not have.

## Rules

**Never weaken a test to make it pass.** Named again here because it is the single most damaging
shortcut available in this codebase, and because a failing verification test is exactly the situation
where it is most tempting.

**A bug fix arrives with a test that fails before it.** For Run-level bugs, the fixture is the recorded
event stream, which makes the replay corpus grow with every incident.

**Escape and invariant failures are stop-the-line.** Not tickets.

**Deterministic suites must be offline.** If a test needs the network, it belongs in `integration` or
`eval`.
