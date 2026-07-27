# 05 — Hello World PoC Roadmap

The plan is sequenced by **dependency and verifiable exit gate**, not by calendar day. Each milestone
ends in a demonstrable, testable capability; the next one is not started until the gate passes. This
matters more than a date-based plan because two of the milestones (P1 sandbox, P3 loop) have
genuinely unknown discovery cost, and a day-indexed schedule would just be re-negotiated on contact
with `/dev/kvm`.

The seven milestones below are the whole PoC. P0–P3 constitute a working single-agent system; P4–P6
turn it into the multi-agent product and prove the economics.

---

## 0. Definition of done for the PoC

A single acceptance test, automated, run in CI:

> **Given** the seed repository `made-demo-fastapi` at a known SHA, with a passing test suite,
> **when** the request *"Add a `GET /healthz` endpoint returning `{"status": "ok"}`, with a test"* is
> submitted via `POST /runs`,
> **then** the system produces branch `made/run-<id>` containing a commit whose declared verification
> command passes inside the sandbox, opens a PR after human approval, and does so:
> - in **under 5 minutes** wall clock,
> - for **under $0.50** in metered LLM spend,
> - with a **complete, replayable event log** (re-folding events reproduces the final state exactly),
> - with the **escape test suite passing** against the same sandbox provider and image,
> - and with a **deliberately impossible variant** of the request (`"make the sun rise in the west,
>   verified by tests"`) terminating in `AWAIT_HUMAN` within 3 attempts and under $0.15 — proving the
>   loop guards, which is the harder and more important half of this gate.

The failure case is a first-class acceptance criterion. A demo that only shows the happy path proves
nothing about constraint 2.

---

## 1. Milestones

### P0 — Skeleton and contracts
*Goal: the shape of the system exists and is testable with zero LLM calls.*

- Repo layout (§2), `uv`/`pyproject`, ruff + mypy strict, pytest, pre-commit, CI.
- Pydantic artifact schemas: `FeatureRequest`, `Spec`, `TaskGraph`, `Task`, `Patch`, `TestReport`,
  `ReviewReport`, `AttemptRecord`, all with `schema_version`.
- Postgres migrations: `run_events`, `run_cursor`, `llm_calls`, `artifacts`, `tenants`, `projects`.
- Content-addressed artifact store (local filesystem behind an S3-shaped interface).
- Pure `decide(state, event) -> Decision` with the transition table from
  [03 §3](03-state-and-dataflow.md#3-the-state-machine), plus the in-process driver and event-fold
  replay.
- `FakeAgent` implementations returning canned artifacts, and a `FakeSandbox`.
- FastAPI: `POST /runs`, `GET /runs/{id}`, `GET /runs/{id}/events`, `POST /runs/{id}/signal`.

**Exit gate:** an end-to-end run completes `INTAKE → DONE` using fakes only; killing the worker
mid-run and restarting resumes from the event log to the identical state; property tests show
`decide()` is total (no state/event pair raises) and that every failure edge reaches a terminal or
`AWAIT_HUMAN` state.

---

### P1 — Sandbox spike (do this before any agent work)
*Goal: prove the isolation boundary and know its real latency. This is the highest-risk unknown, so it
comes first.*

- Implement `SandboxProvider` against one managed Firecracker provider (E2B or Fly Machines).
- Base image: Python 3.12 + git + ripgrep + pytest, pinned by digest, plus the `madeagent` guest binary
  if the provider does not supply its own guest runtime (E2B does; Fly Machines does not).
- Egress: forward proxy with per-run credentials and a hostname allowlist; pinned DNS resolver;
  blackhole metadata IPs. Verify a denial appears in the log.
- Resource limits and both TTLs from [02 §L3](02-secure-execution.md#l3--resources-cgroup-v2-per-vm),
  including a reaper for VMs orphaned by a dead worker.
- **Write the escape test suite** ([02 §7](02-secure-execution.md#7-the-escape-test-suite-required-ci-check))
  and wire it into CI.
- Measure and record: cold create, snapshot resume, `git clone` of the seed repo, `pip install` of its
  dependencies, full test run. These numbers set the product's latency floor and inform the warm-image
  work in [04 §10](04-context-and-cost.md#10-sandbox-cost-levers).

**Exit gate:** every escape test passes; a benchmark JSON of the measured latencies is committed;
orphaned VMs are provably reclaimed within the idle TTL.

---

### P2 — Toolbelt over the sandbox
*Goal: deterministic, host-mediated tools with no model in the loop yet.*

- `read_range`, `grep`, `list_dir`, `symbol_def` (tree-sitter Python grammar only), `apply_patch`,
  `run_verification`.
- Search/replace patch parser and applier with exact-unique-match enforcement and structured rejection
  errors ([04 §4](04-context-and-cost.md#4-edits-are-diffs-and-diffs-are-validated)).
- Patch policy validator: workspace-relative paths only, symlink-resolved, size cap, and rejection of
  `.github/workflows/**`, `.git/**`, submodules, CI config.
- Test-output normaliser producing a stable `failure_signature`.
- Repo map builder with ranking and per-file incremental invalidation.
- Per-state tool authority enforced by the toolbelt factory, so `VERIFY` literally cannot construct a
  write tool.

**Exit gate:** golden tests for each tool against the seed repo; a hand-written patch flows
`apply_patch → lint → run_verification → TestReport` end to end; adversarial patch inputs (traversal,
symlink, oversized, workflow-file) are all rejected; the same failing test yields an identical
signature across two runs on different VMs.

---

### P3 — Single Developer agent with real guards
*Goal: the smallest thing that closes the loop, with cost and loop control from the first LLM call.*

- `LLMClient` with tiers, pinned models, structured output enforcement, retry-once-on-schema-failure,
  usage metering into `llm_calls`, idempotency keys, and a provider fallback.
- Prompt assembler with tokeniser-measured budgets and the cache-friendly ordering from
  [04 §5](04-context-and-cost.md#5-prompt-assembly-for-cache-hits).
- Developer agent for `IMPLEMENT`; orchestrator-run `VERIFY`.
- Progress oracle, attempt caps, cycle detection, budget admission — all of
  [03 §6](03-state-and-dataflow.md#6-loop-prevention-and-cost-containment). Not deferred; retrofitting
  guards after the agent works is how the credit-burn incident happens.
- Run viewer: a server-rendered timeline of events with cost per step.

**Exit gate:** the happy-path acceptance test passes with a `Task` hand-written by a human (no
Architect yet); the impossible-request variant terminates in `AWAIT_HUMAN` within 3 attempts and under
$0.15; forcing an identical patch twice is refused by the progress oracle; a run whose budget is
exhausted mid-flight stops cleanly with an accurate ledger.

---

### P4 — Architect and QA: the multi-agent shape
*Goal: the system decomposes work itself.*

- Architect for `SPEC` and `PLAN`, emitting a validated task DAG where **every task carries a
  `verification_command`** — the plan validator rejects graphs that do not, which is the structural
  reason the system cannot declare success by vibes.
- QA agent authoring the test that encodes the acceptance criterion *before* implementation, so
  `VERIFY` has something real to run.
- Reviewer for `REVIEW` (diff-only context, findings with file/line).
- `TASK_SELECT` topological scheduling; sequential execution only (no task parallelism in the MVP —
  it multiplies git conflict handling and debugging difficulty for no PoC value).
- Replan path: `TASK_FAILED → AWAIT_HUMAN → PLAN` with the failure record as input.

**Exit gate:** the full acceptance test passes end to end from prose to PR with no hand-written task;
a two-task request (endpoint + wire into router) succeeds; a plan without an oracle is rejected by the
validator.

---

### P5 — Evaluation harness and observability
*Goal: stop guessing. This is what makes every later change safe.*

- 20–30 golden tasks across 3 seed repos: trivial, multi-file, ambiguous, impossible, and
  adversarial (a repo containing prompt-injection text in a README and in a test docstring).
- Harness runs the suite against a config matrix (model tier, prompt version) and reports success
  rate, mean cost, mean attempts, human-escalation rate, and P95 latency.
- OpenTelemetry spans per state and per LLM call with token/USD attributes; the cost dashboards from
  [04 §9](04-context-and-cost.md#9-metering-and-the-ledger).
- Replay tool: re-run `decide()` over a historical event stream to verify a fix against a real past
  failure.

**Exit gate:** the harness runs unattended in CI nightly with results committed as a JSON artifact; a
prompt or model change can be evaluated before merge; the injection-repo tasks show no unauthorised
tool use in the audit log.

---

### P6 — Human-in-the-loop and delivery
*Goal: something a design partner can actually use.*

- `AWAIT_HUMAN` with durable approval, TTL expiry, and identity recorded on every signal.
- Git credential broker with ref-scoped, minute-lived tokens; PR creation with the run summary, cost,
  and full task/attempt trail in the body.
- Tenant model: API keys, per-tenant daily cap, concurrency cap, circuit breaker.
- GitHub App install flow (read repo, write branch — **never** write `main`).

**Exit gate:** an external design partner runs the flow on their own private repo, from prose request
to reviewable PR, without any operator intervention; their audit log answers "what did the agent run
and what did it cost".

---

## 2. Repository layout

```
made/
  api/              # FastAPI: runs, signals, webhooks
  orchestrator/
    transitions.py  # decide(): pure, no IO, no clock, no randomness
    driver.py       # effect execution, leasing, event append, crash recovery
    guards.py       # progress oracle, cycle detection, budget admission
  agents/
    base.py         # Agent protocol, AgentContext, AgentResult
    architect.py  developer.py  qa.py  reviewer.py
    prompts/        # versioned; prompt_version recorded on every call
  artifacts/        # Pydantic schemas + content-addressed store
  llm/              # LLMClient, tiers, metering, provider fallback
  sandbox/
    provider.py     # the 6-method Protocol
    e2b.py  fly.py  fake.py
    guest/          # Go source for madeagent
  tools/            # read_range, grep, symbol_def, apply_patch, run_verification
  context/          # repo map, ranking, prompt assembler, normalisers
  store/            # Postgres access, migrations, ledger
  eval/             # harness, golden tasks, seed repos
tests/
  unit/  integration/  escape/    # escape/ is a required CI check
docs/architecture/
```

`Makefile` targets from the first commit: `make dev`, `make test`, `make test-escape`, `make eval`,
`make run REQUEST="..."`. If running the acceptance test is not a one-liner, it will stop being run.

---

## 3. Sequencing rationale (why this order)

- **Sandbox before agents (P1 before P3).** The isolation boundary is the constraint most likely to
  invalidate provider choices and cost assumptions. Discovering at P4 that snapshot resume takes 8
  seconds, or that your provider cannot enforce an egress allowlist, would invalidate work built on
  top of it.
- **Guards with the first LLM call, not after (P3).** Cost controls and loop guards retrofitted onto a
  working agent are always incomplete, because the code was not written to ask permission.
- **One agent before four (P3 before P4).** Multi-agent adds coordination failure modes on top of
  single-agent failure modes. Debug them in isolation.
- **Eval before optimisation (P5 before any prompt tuning).** Without the harness, every prompt change
  is a vibe, and "cheaper model" changes silently raise total cost via extra attempts.

---

## 4. Deferred deliberately

Parallel task execution; multi-language sandbox images; a vector index; a rich web UI; multi-repo
changes; self-hosted Firecracker; Temporal; Kubernetes; fine-tuning; agent-designer configurability;
autonomous merge. Each has a documented trigger condition in the relevant chapter — none should be
pulled forward on aesthetics.

---

## 5. Kill / pivot criteria

Decide these now, while it is still cheap to be honest:

1. **Success rate.** If, after P5, the golden-task success rate on *trivial* tasks is below ~70%
   without human intervention, the value proposition is "an expensive suggestion engine". Pivot toward
   a narrower vertical (e.g. test generation only, or dependency upgrades only) where the oracle is
   strong and the diff is small.
2. **Unit economics.** If cost per successful PR exceeds roughly 20–30% of what the buyer would pay,
   there is no margin for support and inference-price risk. Attack context first
   ([04](04-context-and-cost.md)); if that fails, narrow the scope.
3. **Escalation rate.** If more than ~40% of runs need a human, you are selling supervision, not
   automation. Sell it as a supervised co-pilot with honest positioning, or narrow the task class.
4. **Isolation.** Any escape-suite failure that cannot be closed with the chosen provider is a
   stop-and-fix, not a backlog item. This is the one non-negotiable.

---

## 6. First commit checklist

1. `pyproject.toml`, ruff/mypy strict, pytest, pre-commit, CI running `make test`.
2. Artifact schemas with `schema_version`.
3. `run_events` + `run_cursor` migrations.
4. `decide()` with the transition table and its property tests.
5. `FakeAgent` + `FakeSandbox` and one green end-to-end fake run.
6. `docs/architecture/` (this directory) referenced from the root `README.md`.
