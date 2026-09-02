# M.A.D.E.

**M**ulti-**A**gent **D**evelopment **E**ngine — an environment in which a swarm of role-specialised
agents lives inside a company's development infrastructure and continuously takes over the work that
consumes developer time: dependency upgrades and the code the upgrade breaks, lint and type debt,
mechanical migrations, long-running conversion campaigns, review of human pull requests, TODO debt, and
change requests from people who do not have commit access.

It runs unattended, on the customer's infrastructure or on ours, and every change it delivers arrives
as a branch and a pull request for a human to merge. It never merges anything itself.

**Status: specification only. No application code exists yet.** This repository contains the
architecture and product specification, the normative contracts, and the work queue. Implementation
starts at [`PLAT-01`](docs/05-delivery/02-backlog.md).

> **The vision changed in September 2026** and the specification was rewritten around it. If you
> remember this repository saying something different — single-tenant only, no chat, no web interface,
> a run viewer rather than a console — read
> [the record of what reversed](docs/00-context/06-vision-change-2026-09.md) first. Nothing was
> deleted; the arguments that lost are retained where they were made.

## The distinction everything rests on

The work divides into two categories with fundamentally different properties, and conflating them is
the most damaging thing this system could do
([docs/01-product/06-lanes.md](docs/01-product/06-lanes.md)).

**The verified lane.** A command declared in advance decides the outcome: dependency upgrades,
migrations, code fixes, test generation, codemods. The exit code is the arbiter. Nothing is called
successful unless that command exits zero.

**The advisory lane.** No such command exists: reviewing a pull request, finding bugs, triaging TODO
debt, turning a chat message into a change request. **There is no exit code for "is this review
good".** So the agent proposes, a human decides, and quality is measured statistically over time.

**Advisory output carries no correctness guarantee, and the interface says so in those words.** That is
a product feature rather than a weakness: the verified lane's guarantee is only worth something if it is
scoped honestly, and a suggestion rendered in the typography of a proof destroys both.

**Review by evidence** is what keeps the advisory lane from being another comment generator. Wherever it
is possible, an advisory agent produces the failing test that demonstrates the bug rather than a comment
saying the change looks risky. A reader checks evidence in seconds; an opinion has to be re-derived.
Where evidence is impossible, the finding is marked *unverified* and never dressed as a proof.

## The problem it addresses

Engineering teams lose a large share of their capacity to work that is never the most important thing
today and is always overdue. It is contractually required, low-margin, hard to staff and universally
disliked, and scaling it by hiring stopped being sustainable.

The existing tools split the problem and leave the expensive half in each case. Dependabot and Renovate
open the pull request and leave a red one when the upgrade breaks the build. Claude Code and Cursor fix
that well, and are interactive by design — nobody watches a package bump across two hundred
repositories. Review tools post comments a reader has to re-derive. Migration campaigns live in a
spreadsheet and stall when their champion changes team. And the person who noticed the defect often has
no commit access, so the request dies in a chat thread.

**M.A.D.E. starts where the free tools stop and runs where the interactive tools cannot**: unattended,
reactive, budgeted before each model call, with a complete audit trail. See
[problem and vision](docs/00-context/01-problem-and-vision.md).

## Architecture at a glance

Four long-running process kinds — API, worker, PostgreSQL, object store — plus ephemeral Sandboxes
created per Run. One artifact, two deployment modes: a service we host for many tenants, and an
installation a customer operates. **Which one v1 targets first is an open question**, deliberately
([OQ-01](docs/05-delivery/02-backlog.md#open-questions)).

- **Execution** happens under a kernel that is not the host kernel, with no credentials and no network
  during verification. If the isolation runtime is unavailable, the system refuses to run rather than
  falling back. Multi-tenant hosting raises this requirement rather than lowering it, and the boundary
  adequate for it is [OQ-10](docs/05-delivery/02-backlog.md#open-questions).
  → [execution isolation](docs/02-architecture/04-execution-isolation.md)
- **Repository access** is the system's own scoped application installation, never a human's token, with
  a permission envelope that can be printed, tested and revoked by the customer in one action without
  our cooperation. → [repository access](docs/02-architecture/19-repository-access.md)
- **Control flow** is a state machine executed by LangGraph, with all routing decided by pure predicates
  no model can influence. Six guards make an unbounded Run structurally impossible; a worksite adds four
  declared ceilings and a campaign progress oracle for the same reason one level up.
  → [orchestration and termination](docs/02-architecture/05-orchestration-and-termination.md)
- **Residency** is a property of the control plane — durable ingestion, durable schedules, visible
  queues — **not** long-lived agents holding context. No agent outlives a Run, because a Run that cannot
  be explained from its own record cannot be sold to the person who has to approve it.
  → [persistence and concurrency](docs/02-architecture/17-persistence-and-concurrency.md)
- **Success** in the verified lane is the exit code of a command declared in advance and immutable
  thereafter. → [verification and truthfulness](docs/02-architecture/06-verification-and-truthfulness.md)
- **Progress** on a campaign is measured on **merged state**, by running a declared command on the
  default branch. Delivered but unmerged pull requests are reported as work in flight and never as
  progress. → [worksites](docs/01-product/07-worksites.md)
- **State** is a git branch plus three append-only event logs in Postgres — Run, worksite, request —
  from which everything can be replayed and audited.
  → [audit and replay](docs/02-architecture/09-audit-and-replay.md)
- **Effectiveness** is reported honestly: acceptance rate, cost per merged pull request, human
  intervention rate and time to merge, per lane and per class, computed from the event log by published
  queries, with the count each figure came from — and "insufficient data" rather than a flattering
  percentage over three samples.
  → [the console](docs/01-product/09-web-interface-and-admin-console.md)

The five failures this design treats as project-ending, and the mechanism that prevents each, are named
in the [system overview](docs/02-architecture/01-system-overview.md#the-five-unforgivable-failures).
They are what shapes the rest.

## Where to start

| You are | Start here |
| --- | --- |
| An agent about to do work | [`AGENTS.md`](AGENTS.md), then [the backlog](docs/05-delivery/02-backlog.md) |
| Wondering why this document changed | [the 2026-09 vision change](docs/00-context/06-vision-change-2026-09.md) |
| Evaluating the design | [system overview](docs/02-architecture/01-system-overview.md), then the [ADRs](docs/03-adr/README.md) |
| Trying to understand the product boundary | [lanes](docs/01-product/06-lanes.md), then [scope and personas](docs/01-product/01-scope-and-personas.md) |
| Reviewing security | [security and compliance](docs/02-architecture/13-security-and-compliance.md), then [execution isolation](docs/02-architecture/04-execution-isolation.md) and [repository access](docs/02-architecture/19-repository-access.md) |
| Deciding what to build next | [roadmap](docs/05-delivery/01-roadmap.md) and the [open questions](docs/05-delivery/02-backlog.md#open-questions) |
| Looking for a specific decision | [ADR index](docs/03-adr/README.md) |
| Wondering whether to trust this specification | [evidence and confidence](docs/00-context/05-evidence-and-confidence.md) |
| Implementing against an interface | [`contracts/`](contracts/README.md) — normative, **and currently behind the prose** |

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

Decisions that are genuinely unresolved are marked in place rather than guessed at. There are **more of
them than before the vision change**, which is the honest state of a product whose scope widened three
weeks ago. Five can only be answered by the founder.

**OQ-01** — which deployment shape v1 targets first, hosted or self-hosted. Both are supported and
neither is assumed; one has to be first, because building and supporting both at once is not affordable
for a single maintainer.

**OQ-19** — whether generated planning returns to the critical path so the chat front door can serve
requests no work class covers. **The largest open question in the specification**, and the one genuine
contradiction the vision change created: the narrow front door is what ships, and a request it cannot
serve is declined with reason `requires_generated_plan` so that the frequency of the problem is measured
before the question is answered.

**OQ-10** — whether the execution boundary is sufficient for running several tenants' code on one host.
Open in the direction of a *stronger* boundary: if it is insufficient, hosted operation is suspended
rather than the boundary weakened.

**OQ-09** — how a dependency upgrade obtains its new package version, given that Sandboxes have no
network. Blocks the first sellable capability, and must not be solved by giving the Sandbox network
access.

**OQ-11, OQ-12, OQ-18** — which single worksite, which single advisory capability, and which console
subset go first. These exist to force one choice each rather than all of them, because the largest risk
this vision change created is that six capabilities ship as six half-things.

**OQ-03 is resolved**: existing repositories, in declared work classes
([ADR-0020](docs/03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). The 2026-09 change
widened what the system does *to* existing repositories; it did not reopen greenfield.

All of them, with what each blocks:
[open questions](docs/05-delivery/02-backlog.md#open-questions).

## What this repository does not claim

Nothing here has ever run. The contracts parse, apply to a real database and reject hostile inserts;
everything the vision change added is prose whose contracts have not landed yet, and the specification
says so rather than implying otherwise
([evidence and confidence](docs/00-context/05-evidence-and-confidence.md)). Numbers with no basis are
marked `TBD` with the measurement that would set them, rather than given a plausible value.
