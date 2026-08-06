# Repository structure

Normative. A file in the wrong place is a review-blocking defect, because the layout is what lets
several agents work concurrently: the **Touches** field of a backlog item
([05-delivery/02-backlog.md](../05-delivery/02-backlog.md)) is only meaningful if paths are
predictable.

## Layout

```
made/
  api/                 FastAPI app, routes, request/response models, HTML templates
    routes/            one module per resource: projects, runs, approvals, audit
    templates/         server-rendered views (ADR-0016)
  orchestrator/
    graph.py           LangGraph construction and compilation
    routing.py         PURE routing predicates. No IO, no clock, no randomness
    guards.py          PURE guard predicates (attempt, progress, cycle, budget, plan, patch policy)
    nodes/             node implementations; effects live here, not in routing
    state.py           graph state definition and reducers
  agents/
    base.py            Agent protocol, AgentContext, AgentResult
    architect.py  developer.py  qa.py  devops.py  reviewer.py
    prompts/           versioned prompt templates, one directory per role
  artifacts/
    schemas.py         Pydantic models mirroring /contracts/schemas/
    store.py           content-addressed store interface + object-store implementation
  llm/
    client.py          LLMClient: tiers, admission, metering, fallback, structured output
    tokenizer.py       token counting per tier
    providers/         the ONLY place a vendor name may appear
  sandbox/
    provider.py        SandboxProvider protocol (six operations)
    gvisor.py          the v1 implementation
    fake.py            in-process fake for tests
    reaper.py          orphan destruction
  tools/               read_range, grep, list_dir, symbol_def, references, apply_patch,
                       run_verification, toolbelt factory
  context/
    repo_map.py        tree-sitter extraction and ranking
    assembler.py       budgeted, cache-ordered prompt assembly
    normalise.py       THE failure-output normaliser. Exactly one implementation
  git/                 mirror management, patch extraction, commit trailers, host adapters
  store/               Postgres access, event append, ledger, lease, migrations runner
  audit/               event fold, replay, export
  eval/                golden-task harness, baseline comparison
  config/              settings schema, loading, validation, redaction registry
  observability/       metric definitions and the Prometheus endpoint
  cli/                 the `made` command
contracts/             NORMATIVE. See /contracts/README.md
tests/
  unit/  contract/  integration/  escape/  replay/  eval/
  fixtures/
    repos/             seed repositories used by integration and eval suites
    events/            recorded event streams for the replay corpus
docs/                  this specification
  06-operations/       the operator runbook (created by DOC-01; absent until then)
tools/
  spec_lint/           the contract, link and vocabulary checker (ADR-0018)
migrations/            numbered SQL, forward-only
deploy/                Compose file, bootstrap script, images, example configuration
bench/                 committed benchmark results (sandbox.json, events.json)
eval/                  committed baseline.json
.github/workflows/     CI pipelines
Makefile               the operator and developer interface
```

`tools/` holds development tooling that is not part of the deployed system and is never imported by
anything under `made/`. It is the one place outside `made/` where Python lives.

## Dependency rules

Enforced by an import-boundary lint rule; a violation fails CI. These are not layering aesthetics —
each one prevents a specific failure described elsewhere in this specification.

| Rule | Reason |
| --- | --- |
| `orchestrator/routing.py` and `orchestrator/guards.py` MUST NOT import `llm`, `sandbox`, `store`, `git` or anything performing IO | Purity is what makes routing replayable and testable ([ADR-0002](../03-adr/0002-langgraph-as-executor-with-pure-routing.md)) |
| Only `sandbox/` may know the isolation runtime. No module outside it may import a container or runtime library, or use the words `docker`, `runsc`, `container` or `vm` in an identifier | Seam 1 must stay swappable ([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)) |
| Only `llm/providers/` may name a model vendor | Tier abstraction ([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)) |
| `agents/` MUST NOT import `store`, `git` or `sandbox` directly; it receives a toolbelt | Tool authority must come from the State, not from what an agent can import ([FR-069](../01-product/03-functional-requirements.md)) |
| `tools/` MUST NOT import `agents/` | Tools are given to agents, never the reverse; a cycle here means an agent can construct its own tools |
| Nothing outside `store/` may execute SQL | One place enforces the same-transaction rule for events and effects |
| `context/normalise.py` is the only normaliser. Nothing may reimplement it | The progress oracle and the prompt reducer must not drift ([ADR-0010](../03-adr/0010-termination-guards.md)) |
| `api/` MUST NOT import `orchestrator/nodes/` | The API starts and observes Runs; it never executes one |

## Module shape

Every module gets a docstring stating what it owns and what it must not do. For the modules above
that carry a rule, the docstring cites the rule and the ADR, because the agent that breaks it will be
reading the file rather than this document.

Public surface is explicit: a module exports what it lists in `__all__`. Cross-module imports use the
package path, never a relative traversal above the current package — `from made.tools import grep`,
not `from ..tools import grep`, because relative imports make a file's dependencies invisible when
reading a diff.

Protocols live with their consumer, implementations with their technology. `SandboxProvider` is
defined in `sandbox/provider.py` alongside its implementations because it is a technology seam;
`Agent` is defined in `agents/base.py` because it is a domain protocol.

## Naming conventions

Domain nouns follow the glossary exactly
([00-context/03-glossary.md](../00-context/03-glossary.md)), including in variable names, log fields,
metric names, database columns and API fields. The banned-synonym list is enforced by `spec-lint`
([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).

| Kind | Convention | Example |
| --- | --- | --- |
| Module, function, variable | `snake_case` | `apply_patch`, `failure_signature` |
| Class | `PascalCase` | `SandboxProvider`, `AttemptRecord` |
| Constant, State, guard id | `UPPER_SNAKE` | `GUARD_PROGRESS`, `AWAIT_HUMAN` |
| Test | `test_<unit>_<condition>_<expected>` | `test_progress_oracle_identical_patch_refuses_retry` |
| Migration | `NNNN_<verb>_<subject>.sql` | `0002_add_egress_events.sql` |
| Prompt file | `<role>/<purpose>.v<N>.md` | `architect/plan.v3.md` |
| Money | always suffixed `_usd` | `cost_usd`, `ceiling_usd` |
| Duration | always unit-suffixed | `timeout_s`, `latency_ms` |

## What does not belong in this repository

**Customer data of any kind.** No real repository content, no captured prompts containing customer
source, no production database dumps. Test fixtures are synthetic repositories under
`tests/fixtures/repos/`.

**Secrets.** No `.env` with real values, no API keys, no tokens, not even expired ones. A committed
secret is a rotation event, not a cleanup task. A pre-commit secret scan is mandatory.

**Generated artifacts.** No `__pycache__`, no build output, no coverage HTML, no `node_modules`. The
exceptions are deliberate and small: `eval/baseline.json` and `bench/*.json` are committed because
they are the reference points a regression is measured against
([NFR-027](../01-product/04-non-functional-requirements.md)) — a baseline that is not versioned cannot
be compared.

**Large binaries.** Sandbox images are built and pinned by digest, never committed. Seed repositories
are small and source-only.

**A second application.** No frontend project, no separate agent service, no sidecar
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md),
[ADR-0016](../03-adr/0016-server-rendered-run-viewer.md)).

**Scratch and personal files.** No `notes.md`, no `tmp/`, no `experiments/`. Exploration belongs in a
branch that is deleted, not in the tree an agent will read and mistake for guidance.

**Vendored dependencies.** Pinned by hash in the lock file instead.
