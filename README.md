# M.A.D.E.

**M**ulti-**A**gent **D**evelopment **E**ngine — a self-hosted system in which specialised LLM agents
(Architect, Developer, QA, DevOps, Reviewer) collaborate under a deterministic state machine to change
an existing repository, execute the change in an isolated Sandbox, and prove it with a command that
exits zero before a human is asked to approve it.

**Status: specification only. No application code exists yet.** This repository currently contains the
architecture and product specification, the normative contracts, and the work queue. Implementation
starts at [`PLAT-01`](docs/05-delivery/02-backlog.md).

## The problem it addresses

Autonomous coding agents are opaque, meter their own compute so a reasoning error becomes a bill, and
push a wrong solution forward instead of stopping. Browser prototyping tools produce an application
with no path into a production estate. Open-source agent frameworks solve orchestration and leave
execution running in a shared-kernel container. The organisations most able to pay are the ones least
able to adopt any of them, because their security function cannot answer three questions: what did the
agent execute, where could our source have gone, and what stops a run consuming an unbounded budget.

M.A.D.E. answers those three structurally rather than by assurance. See
[problem and vision](docs/00-context/01-problem-and-vision.md).

## Architecture at a glance

A single-host deployment of four processes — API, worker, PostgreSQL, object store — plus ephemeral
Sandboxes created per Run.

- **Execution** happens under a kernel that is not the host kernel, with no credentials and no network
  during verification. If the isolation runtime is unavailable, the system refuses to run rather than
  falling back. → [execution isolation](docs/02-architecture/04-execution-isolation.md)
- **Control flow** is a state machine executed by LangGraph, with all routing decided by pure
  predicates that no model can influence. Six guards — plan validity, attempt cap, progress oracle,
  cycle detection, budget admission, patch policy — make an unbounded Run structurally impossible.
  → [orchestration and termination](docs/02-architecture/05-orchestration-and-termination.md)
- **Success** is defined by the exit code of a command declared at planning time and immutable
  thereafter. No model output can override it. → [verification and truthfulness](docs/02-architecture/06-verification-and-truthfulness.md)
- **State** is a git branch plus an append-only event log in Postgres, from which any Run can be
  replayed and audited. → [audit and replay](docs/02-architecture/09-audit-and-replay.md)
- **Context** is a ranked tree-sitter symbol map plus lookup tools; the codebase never enters a
  prompt. → [context and retrieval](docs/02-architecture/08-context-and-retrieval.md)

The five failures this design treats as project-ending, and the mechanism that prevents each, are
named in the [system overview](docs/02-architecture/01-system-overview.md#the-five-unforgivable-failures).
They are what shapes the rest — which documents have depth, what the testing strategy weights, and
what the definition of done gates on.

## Where to start

| You are | Start here |
| --- | --- |
| An agent about to do work | [`AGENTS.md`](AGENTS.md), then [the backlog](docs/05-delivery/02-backlog.md) |
| Evaluating the design | [system overview](docs/02-architecture/01-system-overview.md), then the [ADRs](docs/03-adr/README.md) |
| Reviewing security | [security and compliance](docs/02-architecture/13-security-and-compliance.md), then [execution isolation](docs/02-architecture/04-execution-isolation.md) |
| Deciding what to build next | [roadmap](docs/05-delivery/01-roadmap.md) and the [open questions](docs/05-delivery/02-backlog.md#open-questions) |
| Looking for a specific decision | [ADR index](docs/03-adr/README.md) |
| Implementing against an interface | [`contracts/`](contracts/README.md) — normative |

Full index with reading paths: [`docs/README.md`](docs/README.md).

## Repository layout

```
AGENTS.md      operating rules — the first thing an agent reads
contracts/     NORMATIVE machine-readable contracts: state machine, OpenAPI, DDL, JSON Schemas
docs/          the specification: context, product, architecture, ADRs, engineering, delivery
```

Application code will live under `made/` per
[the normative repo structure](docs/04-engineering/01-repo-structure.md).

## Open questions

Eight decisions are genuinely unresolved and are marked in place rather than guessed at. Three of them
gate real work: **OQ-03** (does v1 change an existing repository or generate a new project — the
specification assumes the former, and the whole scope turns on it), **OQ-07** (whether the Architect
can generate valid verification commands or Projects must declare templates), and **OQ-08** (whether
the isolation runtime works on the intended Proxmox host, which must be settled before any customer
install). All eight, with what each blocks:
[open questions](docs/05-delivery/02-backlog.md#open-questions).
