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
**budget** means it fails a performance-budget check in the nightly suite.

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
| NFR-021 | The deployment MUST consist of at most 4 long-running processes (API, worker, Postgres, object store). Adding a fifth requires a superseding ADR. | Review-enforced; asserted against the Compose file in `tests/contract/test_topology.py` | hard fail |
| NFR-022 | The alert catalogue MUST contain at most 8 rules, and expected paging volume MUST be ≤ 3 per week in steady state. | Count asserted in `tests/contract/test_alert_catalogue.py`; volume reviewed monthly | hard fail on count |
| NFR-023 | Control-plane API endpoints excluding Run execution MUST respond at p95 ≤ 250 ms with 4 concurrent Runs in flight. | `tests/integration/bench_api.py` | budget |
| NFR-024 | The control plane MUST run within 2 GB RSS and Postgres within 2 GB on the reference host. | Measured in the nightly integration run | budget |
| NFR-025 | Restoring a full deployment from backup onto a clean host MUST reproduce all Runs, events and artifacts, verified by an automated restore drill. | Monthly automated drill, `tests/integration/test_restore_drill.py` | alert |

## Quality of outcome

These gate the roadmap rather than a build, because a build cannot fix them.

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-026 | Golden-task pass rate on the `trivial` tier MUST be ≥ 70% before the system is offered to a design partner. **Provisional** — this threshold is a kill criterion, not an aspiration ([05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md)). | `tests/eval/` nightly, tracked against baseline | blocks milestone |
| NFR-027 | A prompt, model or tier change MUST NOT reduce golden pass rate by more than 2 percentage points or raise mean cost per successful Run by more than 15% relative to the recorded baseline, without an explicit override recorded in the pull request. | `tests/eval/` comparison against `eval/baseline.json` | hard fail |
| NFR-028 | Zero adversarial golden cases MUST result in a tool call outside the State's declared authority. | `tests/eval/` adversarial tier | hard fail |

## Explicit non-requirements

Stating these prevents engineering that nobody asked for. Each is a decision with a reason, not an
oversight.

**No high availability.** The control plane is a single instance per deployment. A Run interrupted by
a restart resumes from its event log ([NFR-019](#truthfulness-and-auditability--gates-for-uf-3-and-uf-5)),
so an outage delays work rather than losing it. Availability targets above roughly 99% monthly would
require redundancy that a single operator cannot maintain, and the workload is asynchronous batch
work whose users are not waiting on a screen.

**No horizontal scaling in v1.** Concurrency is bounded by one host's capacity, and the expected load
is a handful of concurrent Runs. Designing for a scale-out worker fleet would force distributed
leasing and coordination that the current lease mechanism does not need.

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
