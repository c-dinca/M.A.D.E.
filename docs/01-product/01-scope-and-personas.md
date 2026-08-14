# Scope and personas

## In scope for v1

v1 is one capability, executed safely and provably: **take a maintenance job against an existing
repository — a dependency upgrade, a lint-debt sweep, a mechanical API migration — carry it out
unattended, prove it with the repository's own test suite, and open a pull request for a human to
merge.**

The unit of work is a **work class**, not a free-text request
([05-work-classes.md](05-work-classes.md)). That is what lets the first product ship without generated
planning, and it is what makes the oracle unarguable
([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)).

| In scope | Why it is in |
| --- | --- |
| Register a target repository as a Project with its own budgets, model tiers and sandbox image | Everything else is scoped by a Project; without it there is no boundary for configuration or cost |
| Enable work classes on a Project, each with a fixed task template and a declared oracle | The unit of work ([05-work-classes.md](05-work-classes.md)); it is what lets the first product ship with no generated planning ([FR-081](03-functional-requirements.md)) |
| Create Runs from a work class, by a person **or** on a schedule | Maintenance is recurring and unattended; that is the shape of the work and the reason the interactive tools do not fit it ([FR-082](03-functional-requirements.md)) |
| `dependency_upgrade` as the first work class: bump a dependency and fix what the bump breaks | Strongest available oracle — the repository's own suite — and it starts exactly where the free tools stop ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)) |
| Developer and QA agents implementing Tasks of kind `code` and `test` | The two kinds maintenance work actually needs |
| Enforced `touches` scope per Task | For maintenance work the affected paths are predictable, so the scope is tight and meaningful ([FR-080](03-functional-requirements.md)) |
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
| **Greenfield project generation from a prompt** | Decided against in [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), which also withdraws the specification-phase design that would have enabled it. The oracle for maintenance work already exists in the repository; for a new project it does not, and nobody has asked for one. |
| **Feature development from a ticket** | The market everyone wants, and the one where the interactive tools already fit better. There is no reliable per-Task oracle for "did this implement what was meant", the work is attended, and competing there means competing on rented model quality ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)). |
| **Generated planning (Architect producing a Spec and TaskGraph)** | Fully specified and deliberately deferred behind first revenue. A work class supplies the plan, so the first product needs no planning model call. Keeping the specification is cheap; building it first is not. |
| **Work with no runnable oracle** | "Improve quality", "modernise this module", "make it faster". Each is a judgement call dressed as a task, and admitting one reintroduces the false-green failure the product exists to prevent ([05-work-classes.md](05-work-classes.md)). |
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

**OQ-03 is resolved.** The question was whether v1 changes existing repositories or generates new
projects. It changes existing ones, and more narrowly than the original framing: it removes
**maintenance and technical-debt work** from an engineering team, in the work classes catalogued in
[05-work-classes.md](05-work-classes.md). Greenfield generation is out of scope and
[ADR-0019](../03-adr/0019-specification-first-projects.md) is withdrawn. The decision, its rejected
alternatives and its costs are in
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).

The consequence worth carrying into every other document: the oracle is the repository's **existing**
test suite. Nothing the system writes decides whether the system succeeded, which is the strongest form
of [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)'s guarantee and the
reason this scope was chosen.

## Personas

Four people matter in v1. Each has a different question the system must answer, and a different
surface.

**P1 — Platform operator (the founder, initially; later a platform engineer at the customer).**
Installs and runs the system on a Linux host or Proxmox guest they administer. Comfortable with
Docker, Compose, Postgres and a terminal; not interested in babysitting a distributed system. Works
from a workstation on the same LAN or over a VPN, on a wired or reliable connection — there is no
mobile or offline use. Their question is *"is it running, what did it cost, and what broke."* They are
the reason operational simplicity is a design principle and the alert budget is capped.

**P2 — Lead developer at the buyer.** Reviews the pull requests the system opens, merges or rejects
them, and enables or disables work classes on their repositories. Lives in a git host's pull-request
UI and a terminal. Their question is *"can I review this like a normal pull request rather than audit
it line by line."* They are the reason a Run's output is a branch with a passing verification command
and an attempt trail, not a chat transcript. Note what changed with
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): they no longer submit
free-text requests, because the work arrives from a work class or a schedule.

**P4 — Delivery or engineering manager (the economic buyer).** New with
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md), and at an outsourcing
organisation this is the person who signs. They own maintenance commitments across many client
repositories: work that is contractually required, low-margin, hard to staff and disliked. Their
question is *"how much of this stops consuming senior hours, and what does it cost me per month."*
They never open the run viewer for pleasure. They are the reason cost per successful Run and per
**failed** Run are reported separately
([02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)), and the reason the
merge-rate-without-human-edit metric exists at all.

**P3 — Security reviewer at the buyer.** Appears twice: once before installation, holding a veto, and
again whenever something looks unusual. Reads architecture documents, then the audit export. Their
question is *"what exactly did it execute, what could it reach, and can you prove it."* They are the
reason the event log is append-only and complete rather than best-effort. At an outsourcing
organisation their concern is usually contractual rather than paranoid — the client agreement forbids
sending source to a third party — which the self-hosted deployment satisfies by construction
([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)) and is a materially easier conversation
than persuading a CISO.

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

| Surface | P1 Operator | P2 Lead developer | P4 Delivery manager | P3 Security reviewer |
| --- | --- | --- | --- | --- |
| HTTP control API ([`/contracts/openapi.yaml`](../../contracts/openapi.yaml)) | Primary | Via CLI | No | Read-only, audit endpoints |
| CLI (`made`) | Primary | Primary | No | No |
| Run viewer (server-rendered) | Primary | Secondary | Cost and merge-rate view only | Secondary |
| Git branch and pull request on the target host | No | **Primary** | No | No |
| Work-class configuration per Project | Primary | Primary | Approves the list | No |
| Audit export (JSONL) | Secondary | No | No | **Primary** |
| Configuration files and secrets | Primary | No | No | Reviews once |
| Logs, metrics, alerts | Primary | No | No | No |

P4's single surface is the reason cost per successful and per failed Run are reported separately: it is
the only number they will look at, and an average of the two hides it.

## Core loops the product must close

**The maintenance loop (primary).** Schedule or person triggers a work class → task template
instantiated with no planning model call → implement and verify against the repository's own suite under
guards → human approves delivery → pull request → merged with no further edit. The last clause is the
metric that matters commercially: the share of pull requests merged without a human touching the diff.
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
