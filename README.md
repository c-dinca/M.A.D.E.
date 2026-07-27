# M.A.D.E.

**M**ulti-**A**gent **D**evelopment **E**ngine — a platform where specialised LLM agents (Architect,
Developer, QA, Reviewer) collaborate to plan, write, execute and verify code autonomously, inside
isolated compute, under deterministic control flow and a hard cost budget per run.

Status: **pre-implementation.** The architecture of record for the MVP lives in
[`docs/architecture/`](docs/architecture/README.md).

## The three constraints that shape the design

1. **Secure execution.** Agent-generated code runs in ephemeral Firecracker microVMs with no
   credentials, default-deny egress through an authenticated proxy, and a hard wall-clock TTL. Shared
   kernel containers are not the boundary. See [02-secure-execution.md](docs/architecture/02-secure-execution.md).
2. **Deterministic state.** No free-chat. An orchestrator-owned state machine decides every transition;
   agents return typed artifacts and have no routing authority. Loops are prevented by attempt caps, a
   progress oracle, cycle detection, budget admission control and wall-clock bounds. See
   [03-state-and-dataflow.md](docs/architecture/03-state-and-dataflow.md).
3. **Context and cost.** The codebase never enters the prompt. Agents get a ranked tree-sitter symbol
   map plus lookup tools, and edit through validated search/replace diffs. See
   [04-context-and-cost.md](docs/architecture/04-context-and-cost.md).

## Start here

- [Architecture index and headline decisions](docs/architecture/README.md)
- [Recommended tech stack](docs/architecture/01-tech-stack.md)
- [PoC roadmap and exit gates](docs/architecture/05-poc-roadmap.md)
