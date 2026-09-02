# Testing strategy

The pyramid is deliberately deformed by this project's risk profile. A conventional weighting — many
unit tests, some integration, a few end-to-end — would leave the five unforgivable failures
([01-system-overview.md](../02-architecture/01-system-overview.md#the-five-unforgivable-failures))
covered by the thinnest layer. Two suites here carry weight out of proportion to their size, and one
whole category of behaviour is deliberately not tested for correctness at all.

## Weighting

| Suite | Share of effort | Runs | Covers |
| --- | --- | --- | --- |
| `unit` | ~35% | Every commit | Guards, routing, campaign oracle, normaliser, patch parser, prompt assembler, entitlement check, schemas |
| `contract` | ~10% | Every commit | Schemas parse and match implementations; OpenAPI conformance; state-machine consistency; topology; import boundaries |
| `replay` | ~10% | Every commit | Event-fold determinism for **all three** event logs, crash recovery matrix |
| `integration` | ~20% | Every commit (fast subset), full on merge | Real Postgres, real Sandbox, end-to-end Runs, worksite cycles, request brokering, console rendering |
| **`escape`** | **~15%** | **Every commit; full nightly** | **Every boundary whose failure is a disclosure**: the Sandbox, tenancy, the permission envelope, chat egress |
| `eval` | ~10% | Nightly and on demand | Outcome quality, cost, escalation, injection resistance, advisory evidence states, triage declines |

`escape` at 15% of testing effort is the clearest signal of the risk profile. It is justified by UF-1
and UF-4: it is the only suite whose failure stops the product rather than a build.

> **The 2026-09 vision change widened `escape` rather than adding a suite**, and the reason is a
> deliberate judgement about which failures belong there. Three new boundaries — cross-tenant
> reachability, the repository permission envelope, and the chat posting allowlist — share the property
> that made the escape suite what it is: **their failure returns a plausible answer rather than an
> error.** A missing tenant predicate returns rows. An over-wide git grant succeeds. A leaked source
> fragment in a chat message posts fine. None of them fails a functional test, which is exactly why
> they need a hostile suite rather than a happy-path one
> ([NFR-029](../01-product/04-non-functional-requirements.md),
> [NFR-035](../01-product/04-non-functional-requirements.md),
> [NFR-036](../01-product/04-non-functional-requirements.md)).
>
> The honest cost of not adding a fifth suite: `escape` is now doing two jobs — proving the execution
> boundary and proving the authorisation boundaries — and the second is not what the name suggests. That
> was accepted over a new suite with its own gate and its own maintenance, because the rules that make
> the suite meaningful (real runtime, 100% pass, no quarantine, a case per incident) are exactly the
> rules the new boundaries need.

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

**One case per prohibition, for the boundaries that are lists.** The permission envelope
([FR-123](../01-product/03-functional-requirements.md)) is nine prohibitions, and it gets nine cases,
each asserting that the attempt fails **inside our code** and never reaches the host — because a
prohibition enforced only by the host's grant is a prohibition we cannot honestly claim
([19-repository-access.md](../02-architecture/19-repository-access.md)).

**A seeded corpus for every redaction-shaped boundary.** Credentials
([NFR-008](../01-product/04-non-functional-requirements.md)), cross-tenant access
([NFR-029](../01-product/04-non-functional-requirements.md)) and chat egress
([NFR-036](../01-product/04-non-functional-requirements.md)) all work the same way: plant the values
that must not appear, exercise every path, assert none of them surfaced. A corpus is testable; a
prohibition described in prose is not.

**Tenancy cases run with row-level security active.** A cross-tenant test that passes because the
application filtered correctly proves the application, not the boundary. The point of row-level security
is that it holds when the application forgets, so the suite must exercise it that way — including a
deliberately predicate-less query asserting the database refuses it.

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
| `worksites/oracle.py` | 100% branch | The same argument one level up: a pure predicate that decides whether a campaign continues ([FR-098](../01-product/03-functional-requirements.md)) |
| `requests/entitlements.py` | 100% branch | The only thing between a channel guest and a spend ([FR-107](../01-product/03-functional-requirements.md)) |
| `git/` permission-envelope enforcement | 100% branch | Nine prohibitions, nine tests; a partially covered boundary is a boundary we cannot claim ([NFR-035](../01-product/04-non-functional-requirements.md)) |
| `chat/` posting allowlist | 100% branch | The one place C2 could leave the perimeter into a third party ([NFR-036](../01-product/04-non-functional-requirements.md)) |
| `context/normalise.py` | 100% branch | The progress oracle, the prompt and evidence records all depend on it ([ADR-0010](../03-adr/0010-termination-guards.md)) |
| `tools/apply_patch.py` and the patch policy validator | 100% branch | Silent corruption and privilege escalation both live here |
| `llm/client.py` admission and metering paths | 95% | [NFR-009](../01-product/04-non-functional-requirements.md) has no error budget |
| `store/` tenant-scoping paths | 95% | A missing predicate is a disclosure, not a wrong answer ([NFR-029](../01-product/04-non-functional-requirements.md)) |
| `sandbox/` | 90% plus the escape suite | Coverage is secondary to the escape suite here |
| `store/` | 90% | Transaction boundaries are the audit guarantee |
| `effectiveness/` | 90% | These queries produce the numbers the kill criteria are gated on ([FR-131](../01-product/03-functional-requirements.md)) |
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

Added by the vision change, and each has the same property as the adversarial repository — **the
awkward part is the test**:

| Fixture | Contains | Must not be tidied because |
| --- | --- | --- |
| A repository with a real defect and a passing suite | A bug no existing test catches | It is the only way to exercise the evidence path: the agent must write the failing test |
| A pull request with **no** defect | Nothing wrong | A clean pull request must produce no invented finding, and this is the case that catches a model rewarded for finding things |
| A concern with no executable form | A misleading name, a design smell | It must produce an `unverified` finding rather than silence ([FR-149](../01-product/03-functional-requirements.md)) |
| A repository large enough to slice | Many files under one prefix | A worksite cycle needs more slices than its open-pull-request ceiling to exercise the ceiling at all |
| Chat messages: matching, unmatchable, ambiguous, and injection-bearing | Text designed to defeat triage | Declines are the correct outcome for three of the four, and the reason codes are what OQ-19 is measured with |
| Several synthetic tenants with colliding identifiers | The same branch names, the same digests, the same class names in two tenants | A unique index missing its tenant column surfaces as a mysterious constraint violation, not as a tenancy bug ([02-data-model.md](../02-architecture/02-data-model.md)) |

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

**The console's appearance.** Its *truthfulness rules* are tested and the list is longer than it was:
verification wording, parked Runs not shown as in progress, unknown not rendered as zero, the lane
visible before the content, `demonstrated` rendered differently from `unverified`, work in flight not
rendered as progress, "insufficient data" rather than a percentage over too few observations, and a
queued item showing its position and cause
([FR-132](../01-product/03-functional-requirements.md),
[NFR-037](../01-product/04-non-functional-requirements.md)). Layout is not tested.

**Whether an advisory finding was worth making.** The `advisory` eval tier asserts mechanical properties
— that the evidence state matches what was produced, that nothing was suppressed, that a clean pull
request yields no invented finding. Whether a finding is *useful* requires human acceptance over time
([NFR-031](../01-product/04-non-functional-requirements.md), `TBD`). That is a property of work with no
oracle rather than a gap in the harness, and asserting it in a test would be inventing the judgement the
lane exists to defer to a human
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)).

**Whether a worksite's slice decomposition is good.** The suite can assert that a cycle measures, plans,
enqueues and respects its ceilings. Whether the slices are independently mergeable is discovered on a
real repository with a real reviewer, and it is recorded as a load-bearing unproven claim rather than
tested ([00-context/05-evidence-and-confidence.md](../00-context/05-evidence-and-confidence.md)).

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
