# 04 — Context and Cost Optimisation

The naive design ("stuff the repo into a long-context model") fails on all three axes that matter:
cost scales with repo size × attempts, accuracy degrades as irrelevant context grows, and latency
becomes unusable. This is also where gross margin lives, so it is an architecture concern, not a
tuning exercise for later.

**Governing rule: the model never receives the codebase. It receives a map, and tools to look things
up.**

---

## 1. Context budget

Fixed budgets per state, enforced by a tokeniser-measured assembler that refuses to build an
over-budget prompt (and drops the lowest-priority section instead of silently truncating the middle):

| Section | Budget | Cacheable |
| --- | --- | --- |
| System prompt + role + tool schemas | ~1,200 tok | Yes (stable) |
| Repo map (ranked symbol skeleton) | ~1,500 tok | Yes (stable per commit) |
| Spec + current task | ~800 tok | Yes (stable per task) |
| Retrieved file ranges (tool results) | ~4,000 tok | No |
| Attempt history (compacted `AttemptRecord`s) | ~1,200 tok | No |
| Reserved for output | ~2,000 tok | — |
| **Total per call** | **~10,700 tok** | ~60–70% cache-hittable |

For comparison, a 50k-LOC repository is roughly 600k–800k tokens. The map-plus-tools approach is
two orders of magnitude cheaper per call, and measurably *more* accurate, because precision beats
recall for code edits.

---

## 2. Retrieval hierarchy — structure first, embeddings last

Code identifiers are exact strings; a symbol lookup or `ripgrep` is both cheaper and more precise than
a nearest-neighbour search over chunk embeddings. Query in this order and stop as soon as the budget is
filled:

1. **Repo map** (always present) — a ranked symbol skeleton, described below.
2. **Exact structural lookup** — `symbol_def(name)`, `references(name)` via a tree-sitter/SCIP-style
   index. Precise, deterministic, cheap.
3. **Lexical search** — `grep(pattern, glob)` on `ripgrep`, returning file/line plus tight context.
4. **Graph expansion** — imports/callers/callees one hop from a known-relevant symbol.
5. **Semantic search** — embeddings, **only** for natural-language-ish queries ("where is rate
   limiting handled?") where the identifier is unknown.

Step 5 is deliberately last and is **not in the MVP**. It costs an index, an embedding pipeline, a
staleness problem and a vector store, to improve a query class that steps 1–4 usually answer. Add
`pgvector` when measurement shows structural retrieval failing, not before.

### The repo map

Built with `tree-sitter` per language: for each file, extract top-level definitions with signatures
(no bodies) and rank them by importance on the reference graph — a PageRank-style score over
"who references whom", biased toward symbols mentioned in the task/spec and files touched in previous
attempts. Emit the highest-ranked slice within the ~1,500-token budget:

```
src/api/routes.py
  def create_app(config: Config) -> FastAPI
  def register_routes(app: FastAPI) -> None
src/api/health.py
  def healthz() -> dict[str, str]
src/db/session.py
  class SessionFactory
    def __call__(self) -> Session
```

Cache it keyed by `(commit_sha, task_focus_hash)`; invalidate incrementally per changed file rather
than rebuilding the whole map after every patch.

---

## 3. Toolbelt

Every tool is a narrow, typed, host-mediated function whose availability is a property of the FSM
state ([03 §3](03-state-and-dataflow.md#transition-table-the-authoritative-artefact--the-diagram-is-documentation)).

| Tool | Signature | Notes |
| --- | --- | --- |
| `read_range` | `(path, start_line, end_line) -> str` | Ranges, never whole files. Hard cap ~400 lines; returns a summary plus an outline if exceeded. |
| `grep` | `(pattern, glob?, max_results=40) -> list[Match]` | `ripgrep`, results truncated and deduplicated by file. |
| `symbol_def` | `(name) -> list[Location + signature]` | Tree-sitter index. |
| `references` | `(name, max=40) -> list[Location]` | Reference graph. |
| `list_dir` | `(path, depth=1) -> tree` | Respects `.gitignore`. |
| `apply_patch` | `(edits: list[SearchReplace]) -> PatchResult` | The only write path. Workspace paths only, policy-checked. |
| `run_verification` | `() -> TestReport` | Runs **the task's declared command**. The model supplies no arguments — this is the injection boundary. |

Deliberately excluded from the MVP toolbelt: a free-form shell (available only via
`run_verification`'s fixed command and controlled setup steps), network fetch, and package
installation outside a declared, human-reviewable manifest change.

---

## 4. Edits are diffs, and diffs are validated

Whole-file rewrites are the single largest avoidable cost in agentic coding: output tokens are the
expensive direction, and a rewrite silently reverts unrelated code.

**Format: search/replace blocks with exact-match requirement.**

```
path/to/file.py
<<<<<<< SEARCH
def healthz():
    return {}
=======
def healthz() -> dict[str, str]:
    return {"status": "ok"}
>>>>>>> REPLACE
```

- The `SEARCH` block must match the file **byte-exactly and uniquely**; ambiguity is a rejection with a
  precise error, not a fuzzy apply. Fuzzy patching corrupts files in ways that cost far more than the
  retry it saves.
- Rejections are cheap, structured feedback ("SEARCH block not found in `file.py`; nearest match at
  line 42") and count as an attempt.
- Preferred over unified diff because line numbers drift between the model's view and the file, and
  over "rewrite the file" because output tokens dominate cost.
- After application: syntax check (tree-sitter parse), formatter, linter — all in the sandbox, all
  before spending a model call on verification.

---

## 5. Prompt assembly for cache hits

Provider prompt caching (~10× cheaper on cached input tokens) is the highest-leverage cost lever
available, and it is purely an ordering discipline:

```
[ stable prefix — cache breakpoint after this ]
  system prompt + role
  tool schemas
  repo map (invalidated per commit)
  spec + task definition
[ volatile suffix ]
  compacted attempt history
  tool results for this attempt
  current instruction
```

Never interpolate a timestamp, run id, or randomised instruction into the prefix — one variable byte
early in the prompt destroys the cache for the entire call. **Track cache hit rate as a headline
metric per state**; a regression there shows up as a margin regression before anyone notices it in the
prompt code.

---

## 6. Model routing

One `LLMClient` with capability tiers, not model names, in the calling code:

| Tier | Used for | Selection criteria |
| --- | --- | --- |
| `NAV` (cheap/fast) | File triage, grep result ranking, test-log summarisation, commit messages, ambiguity scoring | Cheapest model that can follow a schema |
| `EDIT` (mid/strong) | Patch generation — the volume workhorse | Best patch-accuracy-per-dollar; measure on your own eval set |
| `PLAN` (frontier) | Spec, task decomposition, escalated review | Best reasoning; low call volume so cost impact is small |
| `CRITIC` (strong, conditional) | Only invoked after a gate failure | Never on the happy path |

Rules: tiers are configured per tenant/plan (a cost dial you can sell); model versions are pinned and
recorded on every span; a provider fallback exists per tier; every tier change is validated against
the eval harness before rollout, because a "cheaper" model that raises the retry count is more
expensive.

---

## 7. Output-side reduction

Test output is often larger than the code. Reduce it before it costs anything:

1. Truncate to the **first N failures** (default 3) plus the summary line.
2. Normalise: strip absolute paths, timestamps, durations, memory addresses, and randomised ids. This
   is what makes the `failure_signature` in [03 §6.2](03-state-and-dataflow.md#62-progress-oracle--the-important-one)
   stable — so it serves both cost and loop prevention.
3. Cap stack traces to the frames inside the workspace.
4. If still over budget, summarise with the `NAV` tier and keep the raw log as an artifact in object
   storage, linked by id.

The same treatment applies to `grep` results, dependency-resolution output, and build logs.

---

## 8. Attempt-history compaction

Do not carry raw transcripts across attempts. After each attempt the orchestrator writes a structured
`AttemptRecord`:

```json
{
  "attempt": 2,
  "changed": ["src/api/health.py:+12/-0"],
  "outcome": "verification_failed",
  "failure_signature": "9f2c…",
  "failure_summary": "ImportError: cannot import name 'router' from 'src.api'",
  "learned": "health module must be registered in register_routes()"
}
```

Roughly 80 tokens replaces several thousand, and it is a better prompt: it states the conclusion
instead of asking the model to re-derive it from a transcript.

---

## 9. Metering and the ledger

```sql
create table llm_calls (
  id             uuid primary key,
  run_id         uuid not null,
  task_id        uuid,
  state          text not null,
  tier           text not null,
  provider       text not null,
  model          text not null,           -- pinned version string
  tokens_in      int  not null,
  tokens_cached  int  not null,
  tokens_out     int  not null,
  cost_usd       numeric(12,6) not null,
  latency_ms     int  not null,
  idempotency_key text not null unique,   -- crash-safe: never pay twice for one logical call
  created_at     timestamptz not null default now()
);
```

Every call is metered in the same transaction that records its event ([03 §4](03-state-and-dataflow.md#4-event-sourcing)).
Dashboards you need from P0, because they are the ones that answer business questions:

- **Cost per successful run** — the number that determines whether a price point exists.
- **Cost per *failed* run** — usually the margin killer, and invisible without this.
- **Attempts per task** distribution, and share of runs hitting `AWAIT_HUMAN`.
- **Cache hit rate** and **tokens per accepted diff line**.
- **Sandbox seconds per run** split into dependency install vs test execution.

Sell in units the customer understands — "task credits" or per-successful-PR — not tokens. Tokens
expose you to provider price changes and to your own inefficiency; a credit lets you improve margin
without renegotiating a contract.

---

## 10. Sandbox cost levers

Compute is the second COGS line and is easy to halve:

- **Warm base snapshots**: a per-project image with dependencies pre-installed, snapshotted after a
  successful `INTEGRATE`. Resuming a snapshot skips the multi-minute `pip`/`npm` install that dominates
  run time.
- **Caching package proxy** (devpi/Verdaccio) in Z1: fast, cheap, and it also enforces the registry
  allowlist from [02 §L4](02-secure-execution.md#l4--network-default-deny). One component, two wins.
- **Targeted test selection**: run the task's `verification_command` during the loop; the full suite
  only at `INTEGRATE`.
- **Aggressive idle TTL**: the sandbox is idle while the model is thinking. Suspend-on-idle with
  snapshot resume beats keeping a VM hot, once snapshot latency is measured.
