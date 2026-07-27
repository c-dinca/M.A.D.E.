# M.A.D.E. — MVP Architecture Proposal

**M**ulti-**A**gent **D**evelopment **E**ngine. A system where specialised LLM agents (Architect,
Developer, QA, Reviewer) collaborate to plan, write, execute and verify code autonomously inside
isolated compute, with deterministic control flow and bounded cost per run.

This directory is the architecture of record for the MVP. It is written to be argued with: every
significant decision lists the alternatives that were rejected and the condition under which the
decision should be revisited.

| Document | Contents |
| --- | --- |
| [01-tech-stack.md](01-tech-stack.md) | Language, orchestration runtime, sandbox, datastores, model providers, deployment topology |
| [02-secure-execution.md](02-secure-execution.md) | Isolation boundary, threat model, egress control, credential brokering, escape test suite |
| [03-state-and-dataflow.md](03-state-and-dataflow.md) | The state machine, event sourcing, git-as-shared-state, typed artifacts, loop and budget enforcement |
| [04-context-and-cost.md](04-context-and-cost.md) | Repo map, retrieval strategy, diff-based editing, prompt caching, model routing, token ledger |
| [05-poc-roadmap.md](05-poc-roadmap.md) | Milestone-by-milestone build plan for the Hello World PoC, with exit criteria and kill criteria |

---

## 1. The one-paragraph version

Build a **control plane** (Python, FastAPI, Postgres) that owns a **deterministic state machine**;
agents are stateless pure functions that receive typed artifacts and return typed artifacts, and
have **no authority to route the workflow**. All code execution happens in **ephemeral Firecracker
microVMs** with no credentials, default-deny egress, and a hard wall-clock TTL. The shared project
state is **a git repository**, not an LLM conversation: every accepted change is a commit, and every
state transition is an append-only event in Postgres, making runs replayable and auditable. Context
cost is controlled by never sending the codebase to the model — the agent navigates via a
tree-sitter symbol map plus `grep`/`read_range` tools and edits via validated search/replace diffs.

## 2. The three constraints, and the mechanism that solves each

| Constraint | Mechanism | Where |
| --- | --- | --- |
| Untrusted code execution must not compromise the host | Hardware virtualisation boundary (Firecracker microVM, KVM), one ephemeral VM per run, zero credentials in guest, default-deny egress via authenticated proxy, no LLM API key in guest | [02](02-secure-execution.md) |
| No free-chat; no infinite loops; no credit burn | Orchestrator-owned FSM with typed transitions, per-task attempt caps, **progress oracle** (a retry is only legal if a monotonic progress metric improved), `(state, artifact_hash)` cycle detection, pre-flight USD budget admission, wall-clock TTL, escalate-to-human instead of retry | [03](03-state-and-dataflow.md) |
| Codebase cannot go into context on every change | Ranked tree-sitter repo map (~1.5k tokens) + tool-based navigation (`grep`, `read_range`, `symbol_def`) + search/replace diff edits + stable-prefix prompt caching + tiered model routing | [04](04-context-and-cost.md) |

## 3. Headline decisions

| Layer | Decision | Primary alternative rejected |
| --- | --- | --- |
| Agent/orchestration language | Python 3.12 | TypeScript (weaker tokeniser/AST/eval tooling); Go (slow prompt-iteration velocity) |
| Workflow runtime | **Own the transition function, rent the durability.** Pure-function FSM + Postgres event log for the PoC; bind the same function to Temporal workflows at multi-tenant scale | LangGraph (in-process durability, checkpoint migration pain, abstraction leakage); CrewAI/AutoGen/MetaGPT (conversation-terminated, no budget primitives — violates constraint 2 by construction) |
| Execution sandbox | Firecracker microVM. **Rent it for the PoC** (E2B or Fly Machines) behind a narrow `SandboxProvider` interface; self-host `firecracker-containerd` on bare metal when gross margin demands it | Docker alone (shared kernel — explicitly out of scope); gVisor (userspace sentry escape = host compromise, syscall-heavy `npm install` penalty) — acceptable fallback, not the target; WASM/WASI (cannot run real toolchains) |
| Shared project state | Git repository, branch per run, commit per accepted patch | Passing files through the message bus; a bespoke virtual filesystem |
| Control-plane state | Postgres, event-sourced append-only `run_events`; state = fold over events | In-memory graph checkpoints; Redis as source of truth |
| Agent-to-agent comms | None. Agents read/write typed, content-addressed artifacts on a blackboard, mediated by the orchestrator | Group chat / broadcast bus (non-deterministic termination, quadratic token cost) |
| Retrieval | Structural first (AST/symbol/grep), embeddings as fallback only | Vector-DB-first RAG (poor precision on code identifiers, index staleness, needless infra) |

## 4. What the MVP deliberately does **not** include

Scope discipline is the main survival factor for a bootstrapped B2B build. Out of MVP:
Kubernetes, a vector database, fine-tuning, multi-repo/monorepo-wide changes, more than one language
runtime in the sandbox image, a graphical agent-designer, self-hosted model inference, real-time
collaborative UI, and any agent that can talk to another agent directly.

## 5. Reading order for an implementer

1. [03-state-and-dataflow.md](03-state-and-dataflow.md) — this is the product. Everything else serves it.
2. [02-secure-execution.md](02-secure-execution.md) — this is the moat and the liability.
3. [04-context-and-cost.md](04-context-and-cost.md) — this is the gross margin.
4. [05-poc-roadmap.md](05-poc-roadmap.md) — build order and exit gates.
