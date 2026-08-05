# Observability and SLOs

Observability here has two consumers with different needs, and conflating them produces a system that
serves neither. The **operator** needs to know that something is wrong and where, at 22:00, alone. The
**auditor** needs a complete forensic record — and that is the event log
([09-audit-and-replay.md](09-audit-and-replay.md)), not this. Logs and metrics are for debugging; the
event log is for truth. Do not use logs as an audit trail, and do not put audit-grade completeness
requirements on logs.

The binding constraint on this whole document is one person
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)). An alert that fires and is ignored has
negative value: it trains the operator to ignore the next one. Hence a hard cap of eight rules
([NFR-022](../01-product/04-non-functional-requirements.md)) — adding a ninth means removing one and
justifying the trade.

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
| Audit completeness | 100% | Always | [NFR-015](../01-product/04-non-functional-requirements.md); no error budget |
| Budget correctness | 100% | Always | No Run exceeds its ceiling ([NFR-009](../01-product/04-non-functional-requirements.md)); no error budget |
| Sandbox creation success | 99% | 7 days | Transient failures are retried; sustained failure is an alert |
| Run completion latency | p95 ≤ 15 min for `trivial` golden tasks | 7 days | Not a user-facing promise; a regression detector |

Three of these have no error budget, which is deliberate. Durability, audit completeness and budget
correctness are the properties the product is sold on; expressing them as percentages would imply that
some violation is acceptable, and none is.

## Alerts

Eight rules, the maximum ([NFR-022](../01-product/04-non-functional-requirements.md)). Each names what
it means and what to do, because an alert without a response is a notification.

| # | Alert | Fires when | Response |
| --- | --- | --- | --- |
| 1 | Escape suite failing | Any escape case fails in CI or the nightly run | Stop the line. No deploy, no new Run on affected hosts. This is the only alert that can stop the product |
| 2 | Audit reconciliation mismatch | Nightly query finds an orphan exec or model call, or a spend mismatch | Investigate before further Runs; a silent divergence invalidates the audit story |
| 3 | Budget invariant violated | Any Run's terminal spend exceeds its ceiling | Treat as a defect in admission control, not as a tuning issue |
| 4 | Worker stalled | No state transition across all non-terminal Runs for 15 minutes while Runs exist | Check worker liveness, lease table, provider availability |
| 5 | Sandbox leak | A `sandbox_session` for a terminal Run has no `destroyed_at` after the idle timeout, or host sandbox count exceeds the concurrency cap | Run the reaper manually; investigate why it did not fire |
| 6 | Dependency unavailable | Model endpoints, git host or object store failing for more than 10 minutes with Runs waiting | Verify the dependency, then decide whether to park Runs |
| 7 | Disk pressure | Data volume above 85% | Prune per retention, expand the volume |
| 8 | Quality regression | Nightly evaluation pass rate drops more than 10 points below baseline, or authority violations are non-zero | Bisect against the last prompt or model change; a non-zero authority violation is treated as a security event |

Explicitly **not** alerted: individual Run failures, guard trips, model fallbacks, high cost on a
single Run, and slow verification. These are normal operation for a system whose product includes
failing honestly. They are visible in metrics and the viewer, where the operator looks deliberately
rather than being interrupted.

## Tracing

OpenTelemetry spans for a Run, one per State and one per effect (model call, Sandbox execution, git
operation), with token counts, cost and cache ratio as attributes. Emitted only when an OTLP endpoint
is configured; the default install has none, since a tracing backend would be a fifth process.

The event log already answers "what happened". Tracing answers "where did the time go", which is a
different and less frequent question — which is why it is optional and the event log is not.

## The run viewer

A server-rendered page per Run ([ADR-0016](../03-adr/0016-server-rendered-run-viewer.md)) showing the
event timeline with cost per step, the current State and reason, each Task with its verification
command and per-Attempt outcome, artifact links, and the total against the ceiling.

Its display rules are product requirements, not styling
([06-verification-and-truthfulness.md](06-verification-and-truthfulness.md)): verification status uses
the words *verified*, *failed verification* or *not verified*; a Run parked in `AWAIT_HUMAN` shows
"waiting for approval" with the reason, never a progress spinner; and unknown values render as
"unknown", never as zero.
