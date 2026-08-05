# Scope and personas

## In scope for v1

v1 is one capability, executed safely and provably: **take a change request against an existing
repository, produce a branch that contains the change plus the tests and deployment artifacts that
prove and ship it, and stop for human approval.**

| In scope | Why it is in |
| --- | --- |
| Register a target repository as a Project with its own budgets, model tiers and sandbox image | Everything else is scoped by a Project; without it there is no boundary for configuration or cost |
| Submit a change request and get a Run | The product's entry point |
| Architect decomposes the request into a Spec and a TaskGraph where every Task carries a verification command | The oracle requirement is the mechanism behind [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures); a plan without oracles is rejected, not executed |
| Developer, QA and DevOps agents implement Tasks of kind `code`, `test` and `iac` | The IaC output is the intake's stated differentiator, and it verifies deterministically (`hadolint`, `docker compose config`, `terraform validate`), so it strengthens rather than dilutes the verification story |
| Deterministic verification in an isolated Sandbox with no network | [UF-1](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) and [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Bounded retries: attempt caps, progress oracle, cycle detection, budget admission, wall-clock TTL | [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Human approval gates, with the Run durably parked while it waits | Autonomy without a gate is unsellable to the buyer who has the veto |
| Push a branch and open a pull request on the target repository's host, never to the default branch | The delivery surface engineers already use |
| Append-only audit log of every executed command, model call and egress decision, exportable | [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Per-run cost ledger and hard ceiling | [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) |
| Server-rendered run viewer showing the event timeline, cost and artifacts | The operator needs to see a run without reading SQL; a full application does not |
| Golden-task evaluation harness | Without it, every prompt and model change is a guess ([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)) |
| Single-host deployment via Compose, on Linux with a container runtime | Matches the operator's actual environment |

## Out of scope for v1, with reasons

Each exclusion is a strategy decision. An agent that implements one of these has damaged the
product, not helped it.

| Excluded | Reason |
| --- | --- |
| **Greenfield project generation from a prompt** | The verification oracle needs an existing test harness to run against. Without one the system can only assert that code exists, not that it works — which is precisely the failure the product is positioned against. Revisited in [02-architecture/15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) once a template-with-harness mechanism exists. This contradicts the "a-z software creator" framing and is the single most important scope decision to confirm (OQ-03, below). |
| **Multi-tenancy** | v1 is one deployment per customer ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)). Multi-tenant isolation would add the hardest part of the threat model for zero v1 revenue. |
| **Parallel Task execution** | LangGraph supports fan-out, and the intake describes it as a target pattern. It is deferred because concurrent patches against one workspace require merge-conflict handling and make failure attribution ambiguous, which directly attacks [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) and [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures). The seam is specified so it is additive later. |
| **Autonomous merge or deploy** | The system opens a pull request; a human merges. Removing the gate removes the reason security approved the install. |
| **More than one language toolchain in the sandbox image** | Each additional toolchain multiplies image size, escape-suite surface and dependency-baking work. v1 ships Python; the image is a Project setting so a second is additive. |
| **Vector search over the repository** | Structural retrieval answers the queries that matter for code, and an index is infrastructure a solo operator must maintain ([ADR-0009](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md)). |
| **Long-term semantic memory across Runs** | The intake proposes it. It is deferred because a memory that silently injects a past conclusion into a new Run is unauditable, and auditability is a v1 gate. Attempt records inside a Run give most of the benefit with none of the opacity. |
| **Billing, plans, entitlements** | No pricing decision exists (OQ-06), and self-hosted v1 has nobody to bill through the software. |
| **Kubernetes** | One operator, one host ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)). |
| **An IDE plugin, chat interface, or mobile surface** | The product is a pipeline, not an editor. |
| **Fine-tuning or hosting our own model weights** | Rented capability, not a moat ([00-context/04-business-model.md](../00-context/04-business-model.md)). |

> **Open question OQ-03** — Whether v1 changes an **existing** customer repository or generates a
> **new** project from a description. This specification assumes the former throughout, because the
> verification oracle that carries [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)
> requires a test harness that already exists and that the system did not write; a scaffold passing
> its own generated tests proves nothing. The intake's "a-z software creator" framing implies the
> latter, so this is the decision most likely to be wrong.
> **Blocks:** the persona set, the Project registration flow ([FR-004](03-functional-requirements.md)
> refuses repositories without a passing baseline), the Architect's planning prompt, and Seam 4 in
> [02-architecture/15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md). It does not
> block the isolation, orchestration or cost work, which is identical either way — which is why the
> roadmap sequences those first.
> **Resolved by:** the founder confirming which of the two the first design partner actually wants. If
> greenfield, a mechanism must be designed by which a generated project inherits a meaningful oracle
> before any implementation starts.

## Personas

Three people matter in v1. Each has a different question the system must answer, and a different
surface.

**P1 — Platform operator (the founder, initially).** Installs and runs the system on a Linux host or
Proxmox guest they administer. Comfortable with Docker, Compose, Postgres and a terminal; not
interested in babysitting a distributed system. Works from a workstation on the same LAN or over a
VPN, on a wired or reliable connection — there is no mobile or offline use. Their question is *"is it
running, what did it cost, and what broke."* They are the reason operational simplicity is a design
principle and the alert budget is capped.

**P2 — Lead developer at the buyer.** Submits change requests, reviews the plan at the approval gate,
reviews the resulting branch, merges or rejects. Lives in a git host's pull-request UI and a
terminal. Their question is *"can I trust this diff enough to review it as a normal PR rather than
audit it line by line."* They are the reason a Run's output is a branch with a passing verification
command and an attempt trail, not a chat transcript.

**P3 — Security reviewer at the buyer.** Appears twice: once before installation, holding a veto, and
again whenever something looks unusual. Reads architecture documents, then the audit export. Their
question is *"what exactly did it execute, what could it reach, and can you prove it."* They are the
reason the event log is append-only and complete rather than best-effort.

## Explicitly not users in v1

Naming these prevents feature requests that would bend the product away from the buyer who pays.

**The non-technical founder or product manager who wants an application built from a description.**
Served by the browser prototyping category. Serving them requires greenfield generation, which v1
excludes for the reason above.

**The hobbyist wanting a free local agent.** Every hour spent on a friendly installer is an hour not
spent on the isolation boundary that unlocks the buyer with a budget.

**A platform team running M.A.D.E. as shared infrastructure for many product teams.** That is the
multi-tenant v2 shape; v1 would fail them on isolation between teams, quota fairness and RBAC.

**Anyone whose repository has no automated tests.** The system cannot verify anything, so it cannot
tell the truth about its output. The correct response is refusal at Project registration
([FR-004](03-functional-requirements.md)), not degraded operation.

## Persona-to-surface matrix

| Surface | P1 Operator | P2 Lead developer | P3 Security reviewer |
| --- | --- | --- | --- |
| HTTP control API ([`/contracts/openapi.yaml`](../../contracts/openapi.yaml)) | Primary | Via CLI | Read-only, audit endpoints |
| CLI (`made`) | Primary | Primary | No |
| Run viewer (server-rendered) | Primary | Secondary | Secondary |
| Git branch and pull request on the target host | No | Primary | No |
| Audit export (JSONL) | Secondary | No | Primary |
| Configuration files and secrets | Primary | No | Reviews once |
| Logs, metrics, alerts | Primary | No | No |

## Core loops the product must close

**The delivery loop (primary).** Request → Spec and TaskGraph → human approves the plan → per Task,
implement and verify under guards → Reviewer comment → human approves the branch → pull request.
Closing this loop is the definition of the PoC in [05-delivery/01-roadmap.md](../05-delivery/01-roadmap.md).

**The honest-failure loop.** Verification fails → progress oracle decides whether another attempt can
learn anything → either one more attempt, or `AWAIT_HUMAN` carrying the attempt trail, the failure
signatures and the spend. This loop closing correctly matters more than the delivery loop, because it
is the one that distinguishes this product from the category it criticises.

**The operator loop.** Install → smoke test → configure model tiers and budgets → observe cost per
run → adjust tiers. If this loop takes more than an evening the product does not get adopted, which
is why [NFR-014](04-non-functional-requirements.md) puts a number on it.

**The evaluation loop.** Change a prompt or a model tier → run the golden suite → compare pass rate,
cost and escalation rate against the recorded baseline → ship or revert. Without this loop, every
improvement is anecdote.
