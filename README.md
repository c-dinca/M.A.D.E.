# M.A.D.E.

**M**ulti-**A**gent **D**evelopment **E**ngine — a self-hosted system that removes maintenance and
technical-debt work from an engineering team. It runs unattended against existing repositories,
carries out jobs in declared **work classes** — dependency upgrades that also fix what the upgrade
breaks, lint and type debt, mechanical API migrations — proves each one with the repository's **own**
test suite inside an isolated Sandbox, and opens a pull request for a human to merge.

The product boundary, its rejected alternatives and its costs are in
[ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md). What it deliberately does
**not** do: build new projects, or implement features from tickets.

**Status: specification only. No application code exists yet.** This repository currently contains the
architecture and product specification, the normative contracts, and the work queue. Implementation
starts at [`PLAT-01`](docs/05-delivery/02-backlog.md).

## The problem it addresses

Engineering teams lose a large share of their capacity to maintenance: dependency upgrades, chores,
repetitive review, mechanical migrations. The work is contractually required, low-margin, hard to staff
and universally disliked, and scaling it by hiring stopped being sustainable.

The existing tools split the problem and leave the expensive half. Dependabot and Renovate open the
pull request and, when the upgrade breaks the build, leave a red one for a senior engineer to fix.
Claude Code and Cursor can do that fix well — but they are interactive by design, assuming a human at a
keyboard approving steps and noticing when a run goes wrong. Nobody watches a package bump across two
hundred repositories.

**M.A.D.E. starts where the free tools stop, and runs where the interactive tools cannot**: unattended,
on a schedule, on the customer's own infrastructure, with a budget ceiling enforced before each model
call and a complete audit trail of everything executed. See
[problem and vision](docs/00-context/01-problem-and-vision.md) and
[work classes](docs/01-product/05-work-classes.md).

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
| Wondering whether to trust this specification | [evidence and confidence](docs/00-context/05-evidence-and-confidence.md) |
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

Decisions that are genuinely unresolved are marked in place rather than guessed at. Two now gate real
work:

**OQ-09** — how a dependency upgrade obtains the new package version, given that Sandboxes have no
network. This blocks the first sellable work class and is the most important open question in the
specification. It must not be solved by giving the Sandbox network access.

**OQ-08** — whether the isolation runtime works on the intended Proxmox host. Must be settled before any
customer install, because otherwise the isolation claim is untested on the platform that matters.

**OQ-03 is resolved**: existing repositories, maintenance work, in declared work classes
([ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). OQ-07 is deferred with
the Architect. All of them, with what each blocks:
[open questions](docs/05-delivery/02-backlog.md#open-questions).
