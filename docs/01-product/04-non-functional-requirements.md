# Non-functional requirements

Every entry is a number with a measurement method and a failure action. "Fast", "secure" and
"reliable" are not requirements and do not appear here.

These budgets are **our design decisions**, not external facts. Where the project intake quoted
third-party performance figures, those are recorded separately and marked unverified in
[00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified);
none of them is used as a budget here. Budgets whose initial value is a considered guess are marked
**provisional**: they are enforced from the first milestone anyway, because a gate that exists and is
occasionally re-tuned catches regressions, and a gate deferred until the "right" number is known
never arrives.

Failure actions: **hard fail** means CI fails or the system refuses to operate; **alert** means it
pages the operator per [02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md);
**budget** means it fails a performance-budget check in the nightly suite; **report only** means the
figure is measured and published but does not gate anything yet.

> **`TBD` values, and why they are a departure.** The 2026-09 vision change created measures with no
> basis at all — how often an agent can produce evidence for a concern, what advisory acceptance rate
> is acceptable, how many worksite cycles should pass before the campaign progress oracle fires. This
> document's usual practice is to set a provisional number and enforce it anyway, on the grounds that a
> gate deferred until the number is certain never arrives. That practice is **suspended for these
> specific entries**: their value is `TBD`, their failure action is **report only**, and each states
> exactly what must be measured to set it. The reason is that a number invented here would be
> indistinguishable from a measured one three documents later, and these are numbers a buyer would be
> shown. Each `TBD` becomes a gate once its baseline exists, and the roadmap milestone that produces
> the baseline is named ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)).

## Isolation and security — gates for UF-1 and UF-4

These do not have percentages. A single failure is a stop-the-line event, because the product's
premise is the boundary.

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-001 | Sandbox create-to-ready MUST be ≤ 5.0 s at p95 and ≤ 10.0 s at p99 on the reference host, measured over 50 consecutive creations of the Project's pinned image. **Provisional.** | `tests/integration/bench_sandbox.py`, recorded to `bench/sandbox.json` | budget |
| NFR-002 | 100% of cases in the escape suite MUST pass on every pipeline run against the real isolation runtime. There is no tolerated failure and no quarantine list. | `tests/escape/` in CI | hard fail |
| NFR-003 | The number of processes on the host able to observe a Sandbox's filesystem MUST be zero apart from the sandbox runtime itself; no host path may be bind-mounted into a Sandbox. | `tests/escape/test_no_host_mounts.py` plus a static check of the sandbox creation call | hard fail |
| NFR-004 | Time from a published CVE affecting the sandbox runtime, its kernel interface or the base image to a patched deployment MUST be ≤ 7 days for high and critical severity. | Manual, tracked in the operator runbook; image digest age reported by a weekly job | alert |
| NFR-005 | A Sandbox MUST have zero credential-shaped values in its environment, filesystem or process arguments, where credential-shaped is defined by the redaction pattern set. | `tests/escape/test_no_credentials.py` scanning the live Sandbox | hard fail |
| NFR-006 | Verification MUST run with zero configured network interfaces other than loopback. | `tests/escape/test_network_disabled.py` asserting interface list and connection failure | hard fail |
| NFR-007 | Zero network destinations outside the Project allowlist MUST be reachable from any Sandbox at any lifecycle stage; every attempt MUST produce a recorded egress event. | `tests/escape/test_egress_*.py` covering HTTP, raw TCP, DNS exfiltration and link-local metadata addresses | hard fail |
| NFR-008 | Redaction MUST remove 100% of values in the seeded-secret corpus from logs, events, artifacts and assembled prompts. | `tests/unit/test_redaction.py` with a corpus of at least 20 credential formats | hard fail |

## Termination and cost — gates for UF-2

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-009 | No Run MUST exceed its declared budget ceiling. Terminal recorded spend MUST be ≤ ceiling for 100% of Runs, with reconciliation error between estimated and actual spend ≤ $0.02 per Run. | `tests/integration/test_budget_enforcement.py`; nightly reconciliation query over all Runs | hard fail |
| NFR-010 | Total Attempts per Run MUST NOT exceed 12, and per Task MUST NOT exceed the Project cap (default 3). | `tests/unit/test_guards.py`, `tests/integration/test_attempt_caps.py` | hard fail |
| NFR-011 | Run wall-clock MUST NOT exceed the Project TTL (default 30 min); Sandbox destruction MUST complete within 60 s of TTL expiry. | `tests/integration/test_ttl.py` | hard fail |
| NFR-012 | A Run given an unsatisfiable request MUST terminate in `AWAIT_HUMAN` having spent ≤ 25% of its ceiling, in ≥ 95% of golden unsatisfiable cases. **Provisional.** | `tests/eval/` unsatisfiable tier | budget |
| NFR-013 | Cached input tokens MUST be ≥ 50% of input tokens on the second and later Attempts of a Task, for providers that report cache usage. **Provisional.** | `tests/eval/` cache-hit report | budget |
| NFR-014 | Assembled prompts MUST NOT exceed 12,000 tokens for any single call; the assembler MUST refuse rather than truncate. | `tests/unit/test_prompt_budget.py` | hard fail |

## Truthfulness and auditability — gates for UF-3 and UF-5

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-015 | 100% of Sandbox process executions and model calls MUST have a corresponding Run event; a reconciliation query comparing `llm_calls` and `sandbox_exec` records against `run_events` MUST return zero orphans. | `tests/integration/test_audit_completeness.py`; nightly reconciliation | hard fail |
| NFR-016 | Folding a Run's event log MUST reproduce the recorded final State, spend and Task outcomes exactly for 100% of Runs in the replay corpus, which MUST contain at least 20 recorded real Runs including at least 5 failures. | `tests/replay/` | hard fail |
| NFR-017 | Appending a Run event MUST complete at p95 ≤ 25 ms and p99 ≤ 100 ms under the reference workload of 4 concurrent Runs. | `tests/integration/bench_events.py` | budget |
| NFR-018 | Zero Runs MUST report a successful outcome without a recorded verification event with exit code 0; enforced as a database-level check and asserted nightly. | `tests/integration/test_no_false_green.py`; SQL invariant query | hard fail |
| NFR-019 | Crash recovery: after killing the worker at any State, the Run MUST resume and reach a terminal State, with zero duplicated model charges, in 100% of injected-crash tests covering every non-terminal State. | `tests/replay/test_crash_matrix.py` | hard fail |

## Operability — sized for one person

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-020 | Bootstrap from a clean supported Linux host to a passing smoke test MUST take ≤ 30 minutes of wall time and ≤ 15 operator commands, all of them listed in [04-engineering/02-local-dev-setup.md](../04-engineering/02-local-dev-setup.md). | Timed run on a fresh VM in the nightly pipeline | budget |
| NFR-021 | The deployment MUST consist of at most 4 long-running process **kinds** (API, worker, Postgres, object store). Adding a fifth kind requires a superseding ADR. Replicating an existing kind is not a fifth kind. **Reinterpreted** by [ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md): the original wording counted processes, which would have forbidden a second worker; counting kinds is a loosening and is recorded as one. Ingestion is routes on `api`; scheduling, worksite driving, chat egress and reaping are loops inside `worker`; the queue is a table in `postgres`. | Review-enforced; asserted against the Compose file in `tests/contract/test_topology.py` | hard fail |
| NFR-022 | The alert catalogue MUST contain at most 8 rules, and expected paging volume MUST be ≤ 3 per week in steady state. | Count asserted in `tests/contract/test_alert_catalogue.py`; volume reviewed monthly | hard fail on count |
| NFR-023 | Control-plane API endpoints excluding Run execution MUST respond at p95 ≤ 250 ms with 4 concurrent Runs in flight. | `tests/integration/bench_api.py` | budget |
| NFR-024 | The control plane MUST run within 2 GB RSS and Postgres within 2 GB on the reference host. | Measured in the nightly integration run | budget |
| NFR-025 | Restoring a full deployment from backup onto a clean host MUST reproduce all Runs, events and artifacts, verified by an automated restore drill. | Monthly automated drill, `tests/integration/test_restore_drill.py` | alert |

## Quality of outcome

These gate the roadmap rather than a build, because a build cannot fix them.

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-026 | Golden-task pass rate on the `trivial` tier MUST be ≥ 70% before the system is offered to a design partner. **Provisional** — this threshold is a kill criterion, not an aspiration ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)). Applies to the **verified lane only**; the advisory lane has no pass rate, which is what NFR-031 exists for. | `tests/eval/` nightly, tracked against baseline | blocks milestone |
| NFR-027 | A prompt, model or tier change MUST NOT reduce golden pass rate by more than 2 percentage points or raise mean cost per successful Run by more than 15% relative to the recorded baseline, without an explicit override recorded in the pull request. | `tests/eval/` comparison against `eval/baseline.json` | hard fail |
| NFR-028 | Zero adversarial golden cases MUST result in a tool call outside the State's declared authority. | `tests/eval/` adversarial tier | hard fail |

## Requirements added by the 2026-09 vision change

Grouped by the failure each serves, as above. Three of them — NFR-029, NFR-035 and NFR-036 — are
disclosure boundaries whose failure is silent, which is why they are hard fails with no tolerated
failure rather than budgets.

### Tenancy and access boundaries — gates for UF-1 and UF-4

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-029 | Zero rows, artifacts, object-store keys, metric series or log lines belonging to one tenant MUST be reachable by a principal of another. Asserted with row-level security active, against a corpus of at least 15 seeded cross-tenant access attempts covering every tenant-scoped table, plus a query-level check that no tenant-scoped query omits its tenant predicate. | `tests/escape/test_cross_tenant_*.py`; a static check over `made/store/` | hard fail |
| NFR-035 | Zero git operations outside the permission envelope MUST be constructible, with one test per prohibition in [FR-123](03-functional-requirements.md) asserting that the attempt fails inside our code and never reaches the host. | `tests/escape/test_permission_envelope.py` | hard fail |
| NFR-036 | Zero messages posted to a chat platform MUST contain source code, patch content, verification output, repository paths, file names or finding bodies, measured against a seeded corpus of at least 20 such values embedded in Run and finding data. | `tests/escape/test_chat_egress_redaction.py` | hard fail |

### Termination and cost — gates for UF-2

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-032 | No worksite MUST exceed its declared spend, Run or duration ceiling. Terminal recorded worksite spend MUST be ≤ ceiling for 100% of worksites, and open pull requests MUST never exceed the declared maximum. | `tests/integration/test_worksite_ceilings.py`; nightly reconciliation over all worksites | hard fail |
| NFR-038 | No request MUST exceed its declared triage and clarification allowance, in questions or in spend, for 100% of requests. | `tests/integration/test_request_allowance.py` | hard fail |
| NFR-040 | The number of consecutive cycles without a fall in the measured remaining count, before the worksite progress oracle fires, MUST be set from measurement rather than judgement. **TBD.** What must be measured: the distribution of cycles-to-first-merge on a real repository with a real reviewer, because too low a value pauses a worksite whose reviewer was on holiday and too high a value burns the ceiling learning nothing. | Recorded from the first worksite's cycle history | report only until the baseline exists |

### Truthfulness and auditability — gates for UF-3 and UF-5

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-033 | 100% of accepted ingress events MUST have a recorded event and MUST be acted on exactly once; a redelivery of the same provider delivery identifier MUST produce no second Run. Reconciliation comparing ingress events to the Runs and requests they created MUST return zero duplicates and zero orphans. | `tests/integration/test_ingress_idempotency.py`; nightly reconciliation | hard fail |
| NFR-034 | Zero queued items MUST exist without a recorded position, age, reason and cause; zero queues MUST be unbounded. | `tests/integration/test_queue_visibility.py`; `tests/contract/test_queue_bounds.py` | hard fail |
| NFR-037 | 100% of the display rules in [FR-132](03-functional-requirements.md), [FR-087](03-functional-requirements.md) and [FR-089](03-functional-requirements.md) MUST be asserted by a test, including that no surface renders an advisory Run in the verified vocabulary and that no measure renders a percentage without its count. | `tests/integration/test_console_truthfulness.py` | hard fail |
| NFR-039 | The computed "merged with no human edit" figure MUST agree with a hand-checked sample of at least 20 merged pull requests spanning a rebase, a squash and a concurrent unrelated commit. Disagreement in the **flattering** direction is a defect, not noise. | Manual drill recorded in `bench/acceptance_measure.json`, repeated when the delivery or merge-detection path changes | alert |
| NFR-041 | Folding the worksite event log and the request event log MUST reproduce their recorded state, counts and spend exactly for 100% of fixtures in the replay corpus. | `tests/replay/test_worksite_fold.py`, `tests/replay/test_request_fold.py` | hard fail |

### Quality of outcome

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-030 | Share of advisory findings carrying an evidence record, per work class. **TBD.** What must be measured: the ratio produced by the first advisory class over at least 50 findings on a real repository. The number is expected to be uncomfortable, and the response to a low value is to narrow the concern types the class emits — **not** to relax [FR-088](03-functional-requirements.md) or [FR-149](03-functional-requirements.md). | `tests/eval/` advisory tier, and the console's evidence ratio | report only until the baseline exists |
| NFR-031 | Advisory acceptance rate per work class — findings resolved by a change, over findings delivered. **TBD.** What must be measured: acceptance and dismissal over at least 50 findings reviewed by a human who is not the author of this system. Until then the advisory lane has no quality gate, which is a stated property of work with no oracle rather than an omission ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)). | Console, from recorded finding resolutions | report only until the baseline exists |
| NFR-042 | Acceptance rate for the verified lane — pull requests merged with no human edit, over pull requests delivered — MUST be measured per work class before the system is offered to a design partner, and it MUST be the gating measurement rather than golden-task pass rate, because it is the same question asked in the buyer's terms. The kill threshold is in [05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md). | Console, verified against NFR-039's hand-checked sample | blocks milestone |

## Explicit non-requirements

Stating these prevents engineering that nobody asked for. Each is a decision with a reason, not an
oversight.

**No high availability.** The control plane is a single instance per deployment. A Run interrupted by
a restart resumes from its event log ([NFR-019](#truthfulness-and-auditability--gates-for-uf-3-and-uf-5)),
so an outage delays work rather than losing it. Availability targets above roughly 99% monthly would
require redundancy that a single operator cannot maintain, and the workload is asynchronous batch
work whose users are not waiting on a screen. **One consequence of residency is worth stating**: an
ingestion outage is the quietest possible failure — nothing breaks, work simply does not happen — which
is why it needs an alert rather than an availability target
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

**No horizontal scaling as a v1 objective**, though it is no longer forbidden. Concurrency is bounded by
one host's capacity and the expected load is a handful of concurrent Runs. Replicating the worker is
permitted by the lease mechanism and by NFR-021's process-*kind* reading, and it is not designed for,
sized or tested. Distributed fairness between tenants is the part that would need real work
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md) names it as the hardest
thing a Postgres queue table does badly).

**No completion estimate for a worksite.** A remaining count and a burn rate invite a projection, and
any projection from a handful of cycles is a number we would be inventing. If one is ever shown, it
carries the number of observations it came from ([FR-139](03-functional-requirements.md)).

**No quality gate on the advisory lane, yet.** NFR-030 and NFR-031 are `TBD` and report-only. This is a
property of work with no oracle, not an omission, and the honest consequence is that the advisory lane
ships on a weaker guarantee than everything else in this document
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)).

**No cross-tenant benchmark figure.** Off by default, requires recorded consent, and none has been
measured ([FR-138](03-functional-requirements.md)).

**No sub-second interactive latency.** A Run takes minutes. Optimising model call latency below the
point where a Run feels responsive buys nothing, because no human is watching a spinner — the surface
is asynchronous by design.

**No 100% task success.** The product's claim is honest failure, not universal success. Engineering
effort spent pushing pass rate above the point of diminishing returns is better spent on making
failures cheaper and more legible ([NFR-012](#termination-and-cost--gates-for-uf-2)).

**No support for repositories without automated tests.** Refused at registration
([FR-004](03-functional-requirements.md)). Serving them would require the system to assert success it
cannot demonstrate.

**No browser compatibility matrix.** The run viewer is server-rendered HTML for one operator on a
current desktop browser. There is no mobile layout, no offline support and no supported-browser
policy.

**No internationalisation.** Interface language is English. Adding a translation layer before a
second market exists is speculative work with a permanent maintenance cost.

**No formal uptime SLA to a customer in v1.** The system is self-hosted; the customer operates it.
Offering an availability commitment for infrastructure we do not run would be dishonest.
