# Observability and SLOs

Observability here has **three** consumers with different needs, and conflating any two produces a
surface that serves neither.

The **operator** needs to know that something is wrong and where, at 22:00, alone. The **auditor**
needs a complete forensic record — and that is the event log
([09-audit-and-replay.md](09-audit-and-replay.md)), not this. Logs and metrics are for debugging; the
event log is for truth. Do not use logs as an audit trail, and do not put audit-grade completeness
requirements on logs.

The third, added by the 2026-09 vision change, is the **buyer**, who needs to know whether the product
paid for itself. That is the **effectiveness dashboard**, and it is deliberately not on this document's
surface ([01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md),
[ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)).

> **The split that matters: activity is operational, effectiveness is product.** Runs executed, findings
> emitted, pull requests opened, cycles completed — these are *operational* metrics for the operator and
> they belong here. They are the numbers that always go up, and every product in this category reports
> them as evidence of value. They are **excluded from the effectiveness dashboard**
> ([01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md)),
> because activity measures what the system did and effectiveness measures what the customer got.
> Putting a Prometheus counter on a renewal decision would be the inconsistency this project cannot
> afford.

The binding constraint on this whole document is one person, and it survived the vision change even
though the ADR that first stated it did not
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md) carries the ceilings
forward). An alert that fires and is ignored has negative value: it trains the operator to ignore the
next one. Hence a hard cap of eight rules
([NFR-022](../01-product/04-non-functional-requirements.md)) — adding a ninth means removing one and
justifying the trade, **which is exactly what the vision change had to do** to make room for an
ingestion alert.

## Logging

Structured JSON to stdout, collected by whatever the host already runs. Every line carries `run_id`,
`task_id`, `attempt_no`, `state` and `request_id` where they exist, because the first question about
any log line in this system is "which Run".

| Level | Used for |
| --- | --- |
| `ERROR` | The system could not do what it was asked and a human may need to act |
| `WARN` | Degradation absorbed automatically: a fallback endpoint used, an effect retried, a Sandbox reaped |
| `INFO` | State transitions, Run lifecycle, effect boundaries |
| `DEBUG` | Off by default; prompt assembly decisions, retrieval choices, tokeniser counts |

A guard trip is `INFO`, not `WARN`. Guards refusing work is the system operating correctly, and
logging correct operation as a warning is how alert fatigue starts. What deserves attention is a guard
tripping *far more often than usual*, which is a metric question rather than a log-level one.

### Redaction rules

Redaction happens before anything is written, in the logging and persistence path, not at read time
([FR-066](../01-product/03-functional-requirements.md)). Never logged at any level, in any
environment:

- Secret values registered at startup: model API keys, repository credentials, the object-store key.
- Anything matching the credential pattern set: bearer tokens, private-key blocks, connection strings
  with embedded passwords, high-entropy strings in fields named like a secret.
- Full prompt or completion bodies. Prompts are stored as artifacts by digest with secrets already
  scrubbed; logging them again doubles the exposure surface for no debugging benefit that the artifact
  does not provide.

Logged deliberately, because they are needed and are not secrets: repository paths and file names,
`grep` patterns, verification commands, model identifiers, token counts and costs.

Source code is **not** categorically redacted from `DEBUG` logs, because debugging retrieval without
seeing what was retrieved is impossible — but `DEBUG` is off by default and enabling it is a
documented, deliberate act with a note in the runbook that it will write source fragments to the log.

## Metrics

Split into the two categories that matter. System metrics tell the operator the machine is healthy;
domain metrics tell them the product is working. Only the second kind can detect the failure that
matters most here — a system that is perfectly healthy and quietly producing worthless Runs.

**System.** Process up/down, API request rate and p95 latency by route, database connection pool
saturation and query p95, worker lease age, disk free on the data volume, sandbox creation rate and
failure rate, reaper destructions.

**Domain.** These map directly onto the unforgivable failures:

| Metric | Detects |
| --- | --- |
| Runs by terminal outcome (`DONE`, `AWAIT_HUMAN` by reason, `ABORTED`, `REJECTED`) | Whether the honest-failure loop is functioning or the system is quietly escalating everything |
| Cost per successful Run and **cost per failed Run**, reported separately | The margin question; the average of the two hides it ([07-cost-control.md](07-cost-control.md)) |
| Attempts per Task, distribution not mean | Retry thrash that a mean would smooth away |
| Guard trip rate by guard id | A spike in `GUARD_PROGRESS` means model quality moved; a spike in `GUARD_BUDGET` means the ceiling is mis-set |
| Verification pass rate on first Attempt | The cleanest single proxy for output quality |
| Cached-token ratio | A prompt-assembly regression, which is invisible in behaviour and visible only here ([NFR-013](../01-product/04-non-functional-requirements.md)) |
| Egress denials by destination | Either a missing allowlist entry or something probing |
| Escalation rate to `AWAIT_HUMAN` | Whether the product is automation or supervision ([00-context/04-business-model.md](../00-context/04-business-model.md)) |
| Sandbox wall-clock seconds per Run, split install versus execute | Where Sandbox cost actually goes |

Added by the vision change. All are **operational** — they tell the operator the machine is working —
and none of them is an effectiveness measure:

| Metric | Detects |
| --- | --- |
| Ingress events accepted, by source, and time since the last one | **The quietest failure in the system.** If ingestion stops, nothing breaks and no work happens ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)) |
| Ingress redelivery rate | A provider retry storm; confirms the idempotency key is doing its job |
| Queue depth, and queue wait p95 **by tenant** | Capacity, and the tenant-fairness weak point that `SKIP LOCKED` does not solve ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) |
| Queue sheds by reason | Work refused at a bound, which must never be silent |
| Worksite cycles completed, and cycles since the remaining count last fell | A campaign about to trip its progress oracle, before it trips |
| Claim wait age, by blocking worksite | Whether path claims are blocking more work than they protect ([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md), revisit trigger) |
| Findings emitted by `evidence_state` | A drift toward `unverified`, which is the evidence requirement quietly failing ([NFR-030](../01-product/04-non-functional-requirements.md)) |
| Requests by outcome, and **declines by reason** | Which work class to build next, and the frequency of `requires_generated_plan`, which is what answers OQ-19 |
| Access denials by permission | A grant changed underneath us; distinguishes a fail-closed boundary from an outage |
| Cross-tenant query attempts blocked by row-level security | **Non-zero is a security event**, not a tuning signal |
| Chat posts by field set, and posts suppressed by the allowlist | Whether the egress allowlist is being exercised or bypassed |

Metrics are exposed in Prometheus text format on a local port. Whether the operator scrapes them is
their decision; the system does not require a monitoring stack to function, because requiring one
would make the four-process ceiling a lie.

## SLOs

Modest and honest, matching what a single-instance self-hosted deployment can actually promise. These
are internal targets for our staging deployment and a template for what a customer can expect; they
are not a contractual SLA, and v1 offers none
([01-product/04-non-functional-requirements.md](../01-product/04-non-functional-requirements.md#explicit-non-requirements)).

| SLO | Target | Window | Rationale |
| --- | --- | --- | --- |
| Control API availability | 99% | 30 days | Single instance, restarts for deploys; work is asynchronous and resumes |
| Run durability | 100% | Always | A Run must never be lost. It may park, abort or fail — silently vanishing is a UF-5 failure, so this has no error budget |
| **Trigger durability** | 100% | Always | An accepted ingress event must produce work or a recorded reason why not. A trigger that vanishes is the reactive form of the same failure ([NFR-033](../01-product/04-non-functional-requirements.md)); no error budget |
| Audit completeness | 100% | Always | [NFR-015](../01-product/04-non-functional-requirements.md), extended to all three event logs; no error budget |
| Budget correctness | 100% | Always | No Run and no worksite exceeds its ceiling ([NFR-009](../01-product/04-non-functional-requirements.md), [NFR-032](../01-product/04-non-functional-requirements.md)); no error budget |
| **Tenant isolation** | 100% | Always | Zero cross-tenant reads ([NFR-029](../01-product/04-non-functional-requirements.md)). **No error budget, and this is the one where a single violation is unrecoverable** rather than embarrassing |
| Sandbox creation success | 99% | 7 days | Transient failures are retried; sustained failure is an alert |
| Run completion latency | p95 ≤ 15 min for `trivial` golden tasks | 7 days | Not a user-facing promise; a regression detector |
| Ingress-to-work latency | p95 ≤ 5 min at the configured concurrency | 7 days | The requester's and reviewer's experienced latency. **Provisional**, and it is a queueing figure rather than a compute one |

**Five of these have no error budget**, which is deliberate. Durability, trigger durability, audit
completeness, budget correctness and tenant isolation are the properties the product is sold on;
expressing them as percentages would imply that some violation is acceptable, and none is.

**Deliberately absent: any SLO on advisory quality.** There is no target acceptance rate, no target
evidence ratio and no target finding volume, because NFR-030 and NFR-031 are `TBD` and report-only
until a baseline exists ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)). A percentage
invented here would be an availability target on a judgement.

**Also absent: a worksite completion SLO.** Progress depends on the customer merging
([FR-096](../01-product/03-functional-requirements.md)), so a completion target would be a commitment
about their review capacity.

## Alerts

Eight rules, the maximum ([NFR-022](../01-product/04-non-functional-requirements.md)). Each names what
it means and what to do, because an alert without a response is a notification.

The vision change adds two things that need alerting and the ceiling did not move, so **two rules were
merged to make room.** That is the rule working as intended: adding a ninth means removing one and
justifying the trade ([NFR-022](../01-product/04-non-functional-requirements.md)).

| # | Alert | Fires when | Response |
| --- | --- | --- | --- |
| 1 | Escape suite failing | Any escape case fails in CI or the nightly run — including the cross-tenant, permission-envelope and chat-egress cases | Stop the line. No deploy, no new Run on affected hosts. This is the only alert that can stop the product |
| 2 | **Integrity reconciliation mismatch** | Nightly query finds an orphan exec or model call, a spend mismatch, an ingress event with two Runs, a finding whose evidence state disagrees with its evidence record, or a queued item with no reason. **Merged from the old alerts 2 and 3** | Investigate before further Runs. A silent divergence invalidates the audit story, and a budget or lane-boundary divergence invalidates a product claim |
| 3 | **Boundary violation** | Any Run's terminal spend exceeds its ceiling, any worksite exceeds one of its four, or row-level security blocks a cross-tenant query attempt | Treat as a defect in admission control or in a tenant predicate, never as a tuning issue. A blocked cross-tenant attempt is a **security event** |
| 4 | Worker stalled | No state transition across all non-terminal Runs for 15 minutes while Runs exist | Check worker liveness, lease table, provider availability |
| 5 | **Nothing is arriving** | No ingress event accepted from a configured source for the configured interval while the deployment is up | **New, and it earns its slot because it is the only failure with no user-visible symptom**: nothing breaks, work simply does not happen ([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)) |
| 6 | Dependency unavailable | Model endpoints, git host, chat platform or object store failing for more than 10 minutes with work waiting | Verify the dependency, then decide whether to park. A chat outage does not affect Runs, but a request must never be reported as answered when the post failed |
| 7 | **Resource pressure** | Data volume above 85%, **or** a Sandbox leak — a `sandbox_session` for a terminal Run with no `destroyed_at` after the idle timeout, or host sandbox count above the cap. **Merged from the old alerts 5 and 7** | Prune or expand; run the reaper manually and investigate why it did not fire |
| 8 | Quality regression | Nightly evaluation pass rate drops more than 10 points below baseline, or authority violations are non-zero, or the evidence ratio for an advisory class falls below its recorded baseline | Bisect against the last prompt or model change. A non-zero authority violation is treated as a security event |

**Why alert 5 was worth a slot, stated as the trade it is.** The two merges above cost real
diagnostic precision: a budget breach and a tenancy block now share a rule, and a full disk and a
leaked Sandbox share another, so the operator has to read the alert body rather than the rule name.
That was accepted because an ingestion failure is the one condition in the whole system that produces
no error, no failed Run, no user complaint and no metric anomaly other than absence — and a reactive
product whose reactions silently stop is indistinguishable from a product nobody is using.

Explicitly **not** alerted: individual Run failures, guard trips, model fallbacks, high cost on a
single Run, slow verification, a paused worksite, a declined request, a dismissed finding, and a
blocked worksite claim. These are normal operation for a system whose product includes failing
honestly — and **a dismissed finding is the advisory lane working**, not a fault
([01-product/06-lanes.md](../01-product/06-lanes.md)). All are visible in metrics and the console, where
the operator looks deliberately rather than being interrupted.

## Tracing

OpenTelemetry spans for a Run, one per State and one per effect (model call, Sandbox execution, git
operation), with token counts, cost and cache ratio as attributes. Emitted only when an OTLP endpoint
is configured; the default install has none, since a tracing backend would be a fifth process.

The event log already answers "what happened". Tracing answers "where did the time go", which is a
different and less frequent question — which is why it is optional and the event log is not.

## The console

The run viewer is now one page inside a larger surface
([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md),
[01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md)).
It still shows, per Run, the event timeline with cost per step, the current State and reason, each Task
with its verification command and per-Attempt outcome, artifact links, and the total against the
ceiling.

Its display rules are product requirements, not styling
([06-verification-and-truthfulness.md](06-verification-and-truthfulness.md),
[FR-132](../01-product/03-functional-requirements.md)): verification status uses the words *verified*,
*failed verification* or *not verified*; a Run parked in `AWAIT_HUMAN` shows "waiting for approval" with
the reason, never a progress spinner; unknown values render as "unknown", never as zero; the lane is
visible before the content; a `demonstrated` finding is rendered differently from an `unverified` one;
work in flight is never rendered as progress; a measure with too few observations renders as
"insufficient data" with its count; and a queued item shows its position, age and cause.

The pages this document's consumer — the operator — cares about are the **queue**, the **repository
access status** and the per-Run detail. The effectiveness dashboard is the buyer's page and is
specified with the console rather than here, for the reason given at the top of this document.
