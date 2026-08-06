# M.A.D.E. documentation index

This directory is the specification of record. It is written for AI coding agents working
concurrently and for the human founder. Read the path that matches your situation; do not read
everything. Context spent on documents you do not need is context unavailable for the work.

Before anything else, read [`/AGENTS.md`](../AGENTS.md). It contains the source-of-truth hierarchy,
the non-negotiable rules and the stop conditions.

## Reading paths

| Situation | Read, in this order |
| --- | --- |
| **I am picking up a backlog item** | [`/AGENTS.md`](../AGENTS.md) → [05-delivery/02-backlog.md](05-delivery/02-backlog.md) (your item only) → the documents listed in that item's **Reading** field → [05-delivery/04-definition-of-done.md](05-delivery/04-definition-of-done.md) |
| **I am new to the project and need the shape of it** | [00-context/01-problem-and-vision.md](00-context/01-problem-and-vision.md) → [02-architecture/01-system-overview.md](02-architecture/01-system-overview.md) → [00-context/03-glossary.md](00-context/03-glossary.md) |
| **I am changing the state machine or a guard** | [02-architecture/05-orchestration-and-termination.md](02-architecture/05-orchestration-and-termination.md) → [`/contracts/state-machine.json`](../contracts/state-machine.json) → [03-adr/0002-langgraph-as-executor-with-pure-routing.md](03-adr/0002-langgraph-as-executor-with-pure-routing.md), [03-adr/0010-termination-guards.md](03-adr/0010-termination-guards.md) |
| **I am touching the sandbox** | [02-architecture/04-execution-isolation.md](02-architecture/04-execution-isolation.md) → [03-adr/0005-gvisor-v1-firecracker-deferred.md](03-adr/0005-gvisor-v1-firecracker-deferred.md), [03-adr/0006-no-network-in-verification-sandbox.md](03-adr/0006-no-network-in-verification-sandbox.md) → [04-engineering/04-testing-strategy.md](04-engineering/04-testing-strategy.md) (escape suite section) |
| **I am adding or changing an API endpoint** | [02-architecture/03-api-design.md](02-architecture/03-api-design.md) → [`/contracts/openapi.yaml`](../contracts/openapi.yaml) → [01-product/03-functional-requirements.md](01-product/03-functional-requirements.md) |
| **I am touching the database** | [02-architecture/02-data-model.md](02-architecture/02-data-model.md) → [`/contracts/db/0001_init.sql`](../contracts/db/0001_init.sql) → [04-engineering/06-ci-cd.md](04-engineering/06-ci-cd.md) (migration safety) |
| **I am adding an LLM call or changing a prompt** | [02-architecture/10-llm-integration-and-evaluation.md](02-architecture/10-llm-integration-and-evaluation.md) → [02-architecture/07-cost-control.md](02-architecture/07-cost-control.md) → [02-architecture/08-context-and-retrieval.md](02-architecture/08-context-and-retrieval.md) |
| **Something is on fire in a running deployment** | [02-architecture/12-observability-and-slos.md](02-architecture/12-observability-and-slos.md) → [02-architecture/09-audit-and-replay.md](02-architecture/09-audit-and-replay.md) → [02-architecture/13-security-and-compliance.md](02-architecture/13-security-and-compliance.md) (incident response) |
| **I am the founder deciding what to build next** | [05-delivery/01-roadmap.md](05-delivery/01-roadmap.md) → [05-delivery/02-backlog.md](05-delivery/02-backlog.md) (open-questions table) → [00-context/04-business-model.md](00-context/04-business-model.md) |
| **I want to know whether to trust this specification** | [00-context/05-evidence-and-confidence.md](00-context/05-evidence-and-confidence.md) — what is proven by execution, what is only internally consistent, what is a guess, and the ranked list of load-bearing unproven claims |

## Structure

- **[00-context/](00-context/)** — why this exists, who is involved, the binding vocabulary, how it makes money, and [what in this specification is actually established versus assumed](00-context/05-evidence-and-confidence.md).
- **[01-product/](01-product/)** — scope, personas, user stories, and the numbered requirements every test traces to.
- **[02-architecture/](02-architecture/)** — how it works. The document set is shaped by the five unforgivable failures named in [02-architecture/01-system-overview.md](02-architecture/01-system-overview.md); risks with their own document are risks that can end the project.
- **[03-adr/](03-adr/)** — the settled decisions, each with the alternative it beat and the cost it carries.
- **[04-engineering/](04-engineering/)** — how to build in this repository without breaking it or colliding with another agent.
- **[05-delivery/](05-delivery/)** — the roadmap, the work queue, the agent playbook, and the gate for "done".

## Document conventions

**Normativity.** Machine-readable files under [`/contracts/`](../contracts/) are normative: where prose
and a contract disagree, the contract wins and the prose is a bug. Prose documents are normative for
everything the contracts cannot express (rationale, procedure, prohibition).

**RFC 2119 keywords.** MUST, MUST NOT, SHOULD, SHOULD NOT and MAY carry their usual force. MUST and
MUST NOT are gates: violating one fails review or CI. SHOULD is a default that requires a written
reason to depart from, recorded in the pull request.

**Stable identifiers.** `FR-###`, `NFR-###`, `US-###`, `ADR-####`, `UF-#` (unforgivable failure),
`GUARD-*`, `OQ-##` (open question) and backlog item IDs are permanent. They are never renumbered or
reused. A requirement that is dropped is marked **Withdrawn** with a reason and its ID stays retired.

**Open questions.** An unresolved decision appears inline as:

> **Open question OQ-##** — what is unknown, what it blocks, and what would resolve it.

An agent that hits one MUST NOT invent an answer. Stop, and report per [`/AGENTS.md`](../AGENTS.md).
Every open question is collected in one table in
[05-delivery/02-backlog.md](05-delivery/02-backlog.md#open-questions).

**Unverified claims.** The project intake contains third-party benchmark and pricing claims. They are
recorded in [00-context/02-ecosystem-and-stakeholders.md](00-context/02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified)
and marked unverified. No decision in this specification depends on one being true. Do not repeat
them as fact.

**Confidence.** Not every statement here carries the same weight of evidence. Some claims were proven
by running something; most are internally consistent and untested; a few are judgement calls marked
**provisional**. Before treating any number or architectural claim as settled, check which category it
falls into: [00-context/05-evidence-and-confidence.md](00-context/05-evidence-and-confidence.md).

**One fact, one home.** Cross-reference with relative links instead of restating. If you find the
same fact written in two documents, one of them is wrong; delete it and link.

## Documents deliberately not written

Stating the gaps prevents an agent from assuming a missing document was an oversight.

| Not written | Why |
| --- | --- |
| Offline / sync protocol | Every actor is a server-side process or an operator on a LAN-connected workstation. There is no disconnected client, so there is no outbox and no conflict resolution to design. Air-gapped *deployment* is a different problem and is covered in [02-architecture/14-integrations.md](02-architecture/14-integrations.md) and [02-architecture/13-security-and-compliance.md](02-architecture/13-security-and-compliance.md). |
| Multi-tenancy | v1 is a single-tenant, self-hosted deployment per customer ([ADR-0013](03-adr/0013-single-tenant-self-hosted-v1.md)). Tenancy is a v2 concern and its seam is specified in [02-architecture/15-future-phase-seams.md](02-architecture/15-future-phase-seams.md). Authorisation, which is non-trivial even single-tenant, lives in [02-architecture/13-security-and-compliance.md](02-architecture/13-security-and-compliance.md). |
| Geospatial design | No geographic data exists in this system. |
| Mobile / frontend architecture | v1 ships a server-rendered run viewer only ([ADR-0016](03-adr/0016-server-rendered-run-viewer.md)). There is no client application to architect. |
| Data-lineage document | The system stores no analytical dataset. Provenance of generated code is handled by the audit log ([02-architecture/09-audit-and-replay.md](02-architecture/09-audit-and-replay.md)); model and prompt versioning is in [02-architecture/10-llm-integration-and-evaluation.md](02-architecture/10-llm-integration-and-evaluation.md). |
| Legacy migration and cutover | This is a greenfield system. It replaces manual work, not a running application, so there is nothing to cut over from. |
| On-call rota and ownership boundaries | The team is one person ([ADR-0013](03-adr/0013-single-tenant-self-hosted-v1.md)). The alert budget in [02-architecture/12-observability-and-slos.md](02-architecture/12-observability-and-slos.md) is sized for that reality instead. |

## Superseded material

An earlier architecture proposal lived in `docs/architecture/` and was merged before this
specification existed. It is removed rather than kept, because it contradicts decisions taken here —
notably [ADR-0002](03-adr/0002-langgraph-as-executor-with-pure-routing.md) (LangGraph is adopted, not
rejected) and [ADR-0005](03-adr/0005-gvisor-v1-firecracker-deferred.md) (gVisor is the v1 boundary,
not a fallback). Its reasoning survives inside the ADRs that reversed it. Two contradicting
architectures in one repository is the failure this specification exists to prevent.
