# M.A.D.E. documentation index

This directory is the specification of record. It is written for AI coding agents working
concurrently and for the human founder. Read the path that matches your situation; do not read
everything. Context spent on documents you do not need is context unavailable for the work.

Before anything else, read [`/AGENTS.md`](../AGENTS.md). It contains the source-of-truth hierarchy,
the non-negotiable rules and the stop conditions.

## Reading paths

| Situation | Read, in this order |
| --- | --- |
| **I remember this repository saying something different** | [00-context/06-vision-change-2026-09.md](00-context/06-vision-change-2026-09.md) — what the founder changed, what reversed, what survived, and the one contradiction the rewrite did not resolve |
| **I am picking up a backlog item** | [`/AGENTS.md`](../AGENTS.md) → [05-delivery/02-backlog.md](05-delivery/02-backlog.md) (your item only, **and check its `CON-` contract item has merged**) → the documents listed in that item's **Reading** field → [05-delivery/04-definition-of-done.md](05-delivery/04-definition-of-done.md) |
| **I am new to the project and need the shape of it** | [00-context/01-problem-and-vision.md](00-context/01-problem-and-vision.md) → [01-product/06-lanes.md](01-product/06-lanes.md) (**the distinction everything rests on**) → [01-product/05-work-classes.md](01-product/05-work-classes.md) (the unit of work) → [02-architecture/01-system-overview.md](02-architecture/01-system-overview.md) → [00-context/03-glossary.md](00-context/03-glossary.md) |
| **I am changing the state machine or a guard** | [02-architecture/05-orchestration-and-termination.md](02-architecture/05-orchestration-and-termination.md) → [`/contracts/state-machine.json`](../contracts/state-machine.json) → [03-adr/0002-langgraph-as-executor-with-pure-routing.md](03-adr/0002-langgraph-as-executor-with-pure-routing.md), [03-adr/0010-termination-guards.md](03-adr/0010-termination-guards.md) |
| **I am touching the sandbox** | [02-architecture/04-execution-isolation.md](02-architecture/04-execution-isolation.md) → [03-adr/0005-gvisor-v1-firecracker-deferred.md](03-adr/0005-gvisor-v1-firecracker-deferred.md), [03-adr/0006-no-network-in-verification-sandbox.md](03-adr/0006-no-network-in-verification-sandbox.md) → [04-engineering/04-testing-strategy.md](04-engineering/04-testing-strategy.md) (escape suite section) |
| **I am touching anything advisory** | [01-product/06-lanes.md](01-product/06-lanes.md) → [03-adr/0022-two-lanes-verified-and-advisory.md](03-adr/0022-two-lanes-verified-and-advisory.md), [03-adr/0023-advisory-findings-carry-evidence.md](03-adr/0023-advisory-findings-carry-evidence.md) → [02-architecture/06-verification-and-truthfulness.md](02-architecture/06-verification-and-truthfulness.md) (the lane boundary) |
| **I am touching a worksite** | [01-product/07-worksites.md](01-product/07-worksites.md) → [03-adr/0024-worksites-as-long-running-campaigns.md](03-adr/0024-worksites-as-long-running-campaigns.md) → [02-architecture/17-persistence-and-concurrency.md](02-architecture/17-persistence-and-concurrency.md) |
| **I am touching the chat front door** | [01-product/08-chat-front-door.md](01-product/08-chat-front-door.md) → [03-adr/0025-chat-front-door-request-broker.md](03-adr/0025-chat-front-door-request-broker.md) → [02-architecture/13-security-and-compliance.md](02-architecture/13-security-and-compliance.md) (adversary A6), [02-architecture/14-integrations.md](02-architecture/14-integrations.md) |
| **I am touching a query, an index or the store** | [02-architecture/18-deployment-and-tenancy.md](02-architecture/18-deployment-and-tenancy.md) → [02-architecture/02-data-model.md](02-architecture/02-data-model.md) (query rules) → [`/contracts/db/0001_init.sql`](../contracts/db/0001_init.sql) |
| **I am touching git delivery** | [02-architecture/19-repository-access.md](02-architecture/19-repository-access.md) → [03-adr/0027-scoped-application-identity-branches-only.md](03-adr/0027-scoped-application-identity-branches-only.md) → [03-adr/0015-credential-brokering-no-secrets-in-sandbox.md](03-adr/0015-credential-brokering-no-secrets-in-sandbox.md) |
| **I am adding or changing an API endpoint** | [02-architecture/03-api-design.md](02-architecture/03-api-design.md) → [`/contracts/openapi.yaml`](../contracts/openapi.yaml) → [01-product/03-functional-requirements.md](01-product/03-functional-requirements.md) |
| **I am touching the database** | [02-architecture/02-data-model.md](02-architecture/02-data-model.md) → [`/contracts/db/0001_init.sql`](../contracts/db/0001_init.sql) → [04-engineering/06-ci-cd.md](04-engineering/06-ci-cd.md) (migration safety) |
| **I am adding an agent role** | [02-architecture/16-agent-role-model.md](02-architecture/16-agent-role-model.md) — the five properties that define a role, and the check that stops a prompt variant being called one |
| **I am adding an LLM call or changing a prompt** | [02-architecture/10-llm-integration-and-evaluation.md](02-architecture/10-llm-integration-and-evaluation.md) → [02-architecture/07-cost-control.md](02-architecture/07-cost-control.md) → [02-architecture/08-context-and-retrieval.md](02-architecture/08-context-and-retrieval.md) |
| **I am building a reporting surface** | [01-product/09-web-interface-and-admin-console.md](01-product/09-web-interface-and-admin-console.md) → [03-adr/0028-web-console-as-a-product-surface.md](03-adr/0028-web-console-as-a-product-surface.md) → [02-architecture/12-observability-and-slos.md](02-architecture/12-observability-and-slos.md) (activity is operational, effectiveness is product) |
| **Something is on fire in a running deployment** | [02-architecture/12-observability-and-slos.md](02-architecture/12-observability-and-slos.md) → [02-architecture/09-audit-and-replay.md](02-architecture/09-audit-and-replay.md) → [02-architecture/13-security-and-compliance.md](02-architecture/13-security-and-compliance.md) (incident response) |
| **I am the founder deciding what to build next** | [05-delivery/01-roadmap.md](05-delivery/01-roadmap.md) → [05-delivery/02-backlog.md](05-delivery/02-backlog.md) (**the open-questions table — five of them only you can answer**) → [00-context/04-business-model.md](00-context/04-business-model.md) |
| **I want to know whether to trust this specification** | [00-context/05-evidence-and-confidence.md](00-context/05-evidence-and-confidence.md) — what is proven by execution, what is only internally consistent, what is a guess, and the ranked list of load-bearing unproven claims |

## Structure

- **[00-context/](00-context/)** — why this exists, who is involved, the binding vocabulary, how it makes money, [what in this specification is actually established versus assumed](00-context/05-evidence-and-confidence.md), and [what the 2026-09 vision change reversed](00-context/06-vision-change-2026-09.md).
- **[01-product/](01-product/)** — scope, personas, [the two lanes](01-product/06-lanes.md) (the distinction the product rests on), [work classes](01-product/05-work-classes.md) (the unit of work), [worksites](01-product/07-worksites.md), [the chat front door](01-product/08-chat-front-door.md), [the console](01-product/09-web-interface-and-admin-console.md), [deferred scope](01-product/10-deferred-scope.md), user stories, and the numbered requirements every test traces to.
- **[02-architecture/](02-architecture/)** — how it works. The document set is shaped by the five unforgivable failures named in [02-architecture/01-system-overview.md](02-architecture/01-system-overview.md); risks with their own document are risks that can end the project.
- **[03-adr/](03-adr/)** — the settled decisions, each with the alternative it beat and the cost it carries. ADR-0021 to ADR-0028 were written together for the vision change and should be read as a set.
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

**There are more open questions than before the 2026-09 vision change, not fewer**, and that is the
correct state for a product whose vision changed recently. Five of them can only be answered by the
founder; two are answered by measurements the system itself produces, which is why the instrument was
built before the question was asked. A rewrite that closed them all would have closed them by
invention.

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
| Offline / sync protocol | Every actor is a server-side process, an operator on a connected workstation, or a requester in a chat client we do not build. There is no disconnected client, so there is no outbox and no conflict resolution to design. |
| ~~Multi-tenancy~~ | **Now written.** [02-architecture/18-deployment-and-tenancy.md](02-architecture/18-deployment-and-tenancy.md), following [ADR-0021](03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md). The row is kept struck through because the previous entry said tenancy was a v2 concern, and a reader who remembers that needs to learn where it went rather than conclude the index is stale. |
| Geospatial design | No geographic data exists in this system. |
| Mobile / frontend architecture | The console is server-rendered ([ADR-0028](03-adr/0028-web-console-as-a-product-surface.md), [FR-133](01-product/03-functional-requirements.md)). There is no client application to architect, and the only mobile surface any persona has is their own chat client. |
| Data-lineage document | The system stores no analytical dataset. Provenance of generated code is handled by the audit log ([02-architecture/09-audit-and-replay.md](02-architecture/09-audit-and-replay.md)); model and prompt versioning is in [02-architecture/10-llm-integration-and-evaluation.md](02-architecture/10-llm-integration-and-evaluation.md). |
| Legacy migration and cutover | This is a greenfield system. It replaces manual work, not a running application, so there is nothing to cut over from. Note that **tenancy needed no migration** for the same reason: it was decided before any row existed ([ADR-0021](03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). |
| On-call rota and ownership boundaries | The team is one person. The alert budget in [02-architecture/12-observability-and-slos.md](02-architecture/12-observability-and-slos.md) is sized for that reality instead — and it stayed at eight rules through the vision change, with two merged to make room for one addition. |
| A pricing document | No pricing decision exists (OQ-06), and the intake supplied no figures. [00-context/04-business-model.md](00-context/04-business-model.md) specifies the **structure** and marks every missing number. |
| Competitor comparisons beyond the intake's | The intake's positioning table is recorded and marked unverified in [00-context/02-ecosystem-and-stakeholders.md](00-context/02-ecosystem-and-stakeholders.md). Nothing beyond it has been supplied, and inventing market material would poison the decisions downstream. |

## Superseded material

An earlier architecture proposal lived in `docs/architecture/` and was merged before this
specification existed. It is removed rather than kept, because it contradicts decisions taken here —
notably [ADR-0002](03-adr/0002-langgraph-as-executor-with-pure-routing.md) (LangGraph is adopted, not
rejected) and [ADR-0005](03-adr/0005-gvisor-v1-firecracker-deferred.md) (gVisor is the v1 boundary,
not a fallback). Its reasoning survives inside the ADRs that reversed it. Two contradicting
architectures in one repository is the failure this specification exists to prevent.
