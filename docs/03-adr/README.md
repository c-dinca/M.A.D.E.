# Architecture decision records

An ADR exists so that a settled question is not re-litigated, and so that an agent encountering a rule
understands the constraint behind it. It is not a changelog and it is not a design document; it records
one decision, the alternative it beat, and the price paid.

**All ADRs survive the 2026-09 cut** ([ADR-0033](0033-one-verified-lane-one-judgement-lane.md)).
Decision history is cheap and losing it is expensive: the specification shrank from 79 documents to
eight, and these records are where the reasoning behind the cut material lives. An ADR marked
**Suspended** is not wrong — its subject is deferred, and it is the design to revive rather than
reinvent if the scope returns ([07-deferred.md](../07-deferred.md)).

## Status values

`Accepted` — in force; the code must comply.
`Suspended by the 2026-09 cut` — the decision stands, its subject is deferred. Read it before
rebuilding that subject; do not implement it now.
`Superseded by ADR-XXXX` — historical, retained for its reasoning.
`Withdrawn` — proposed and abandoned, with the reason recorded.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-python-312-orchestrator-language.md) | Python 3.12 for the control plane and agent layer | Accepted |
| [0002](0002-langgraph-as-executor-with-pure-routing.md) | LangGraph executes the graph; routing predicates stay pure and ours | Accepted |
| [0003](0003-postgres-as-system-of-record.md) | PostgreSQL is the single system of record, including the checkpointer | Accepted |
| [0004](0004-event-log-separate-from-checkpoints.md) | The Prompt Book is the audit source; framework checkpoints are a resumption cache | Accepted |
| [0005](0005-gvisor-v1-firecracker-deferred.md) | A user-space kernel is the isolation boundary | **Stood down for v1** by [ADR-0030](0030-container-isolation-with-egress-allowlist.md); its provider seam survives |
| [0006](0006-no-network-in-verification-sandbox.md) | Verification runs with no network; dependencies baked into a pinned image | **Superseded by ADR-0030** |
| [0007](0007-git-worktree-as-project-state.md) | Git holds repository state; graph state holds references, never file contents | Accepted |
| [0008](0008-search-replace-patch-format.md) | Edits are exact-match search/replace blocks | Accepted — and it is now the conflict detector ([ADR-0031](0031-optimistic-concurrency-not-exclusive-claims.md)) |
| [0009](0009-tool-mediated-retrieval-no-vector-db.md) | Structural retrieval and a repository map; no vector index | Accepted |
| [0010](0010-termination-guards.md) | Layered termination guards, including a progress oracle | Accepted |
| [0011](0011-durable-human-approval-gates.md) | Human approval is a durable state, and delivery approval is mandatory | Accepted — this is The Call |
| [0012](0012-model-tiers-and-provider-abstraction.md) | Capability tiers with an OpenAI-compatible adapter; no default model | Accepted |
| [0013](0013-single-tenant-self-hosted-v1.md) | Single-tenant, self-hosted, four processes, one operator | Superseded by ADR-0021, and its **single-tenant argument returns** in [ADR-0029](0029-hosted-first-one-instance-per-client.md) |
| [0014](0014-verification-oracle-is-authoritative.md) | The verification exit code is the sole definition of success | Accepted — the load-bearing decision |
| [0015](0015-credential-brokering-no-secrets-in-sandbox.md) | Execution environments hold no credentials; git writes happen control-plane side | Accepted |
| [0016](0016-server-rendered-run-viewer.md) | Server-rendered viewer; no single-page application | Superseded by ADR-0028 |
| [0017](0017-content-addressed-artifact-store.md) | Artifacts are content-addressed in an object store | Accepted |
| [0018](0018-spec-as-contract-and-spec-lint.md) | Contracts are normative and enforced by a spec-lint gate | Accepted |
| [0019](0019-specification-first-projects.md) | Specification-first projects; a generated specification bundle | Withdrawn by ADR-0020 |
| [0020](0020-technical-debt-remediation-as-the-v1-product.md) | Technical-debt remediation on existing repositories is the product; recipes replace generated planning | Accepted — narrowed further by [ADR-0033](0033-one-verified-lane-one-judgement-lane.md) |
| [0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md) | One deployment-agnostic core with an enforced multi-tenant boundary | **Superseded by ADR-0029** |
| [0022](0022-two-lanes-verified-and-advisory.md) | Work is separated into a verified lane and a judgement lane, and both ship | Accepted — its role set narrowed by [ADR-0032](0032-three-actors-two-roles.md) |
| [0023](0023-advisory-findings-carry-evidence.md) | A judgement-lane comment carries executable evidence or is marked unverified | Accepted — the differentiator |
| [0024](0024-worksites-as-long-running-campaigns.md) | A Show is a bounded campaign measuring progress on merged state | **Suspended by the 2026-09 cut**, except that its exclusive path claims are replaced by [ADR-0031](0031-optimistic-concurrency-not-exclusive-claims.md) |
| [0025](0025-chat-front-door-request-broker.md) | A chat request is brokered into an entitled recipe or declined | **Suspended by the 2026-09 cut** — Front of House is deferred; the narrow-versus-wide argument is what OQ-19 turns on |
| [0026](0026-resident-agents-event-ingestion-visible-queues.md) | Residency is durable ingestion and visible queues, not immortal agents | **Suspended by the 2026-09 cut** — its refusal of context-carrying agents still binds |
| [0027](0027-scoped-application-identity-branches-only.md) | The system authenticates as its own scoped installation; branches and Previews only | Accepted |
| [0028](0028-web-console-as-a-product-surface.md) | The console is a product surface with an effectiveness dashboard | **Partly suspended** — the Booth is minimal and Box Office survives; the rest of the page set is deferred |
| [0029](0029-hosted-first-one-instance-per-client.md) | Hosted first, one isolated instance per client; no shared multi-tenant runtime | Accepted |
| [0030](0030-container-isolation-with-egress-allowlist.md) | Container isolation with a deny-by-default egress allowlist; microVM deferred | Accepted |
| [0031](0031-optimistic-concurrency-not-exclusive-claims.md) | Optimistic concurrency between Scenes; conflicts detected at merge, the loser re-runs | Accepted |
| [0032](0032-three-actors-two-roles.md) | Three actors, of which two are roles: Stage Manager, Crew, Prompter | Accepted |
| [0033](0033-one-verified-lane-one-judgement-lane.md) | v1 is one verified lane and one judgement lane; the specification is cut to eight documents | Accepted |

## Reading order for the current shape

ADR-0033 (what v1 is), then ADR-0029 (where it runs), ADR-0030 (how it is isolated), ADR-0032 (who
acts), ADR-0014 and ADR-0023 (what makes an outcome true in each lane), ADR-0031 (how parallel work
resolves). The rest are settled infrastructure decisions or history.

Two questions closed by this round are worth naming because they had been blocking:
**OQ-09** — how a dependency upgrade obtains its new version — is closed by ADR-0030's egress
allowlist. **OQ-10** — whether the isolation boundary survives — is closed by ADR-0029 removing the
cross-customer threat and ADR-0030 sizing the boundary to what remains.

## Rules for writing one

**One decision per record.** If the title needs "and", it is two ADRs.

**Present the rejected alternative as its strongest self.** An ADR that defeats a straw man is worse
than no ADR: it gives false confidence that the question was examined. State the case an advocate for
that option would make, then say why it lost. Frequently the honest reason is operational cost or team
size rather than technical superiority — say that.

**Negative consequences are mandatory.** If a decision has no cost, it was not a decision; it was a
preference. The consequences section is the most useful part of the record six months later, because
it tells the reader whether the pain they are feeling was anticipated.

**Include a revisit trigger.** A measurement, a scale threshold, or a customer requirement. "When it
becomes a problem" is not a trigger.

**Never edit an accepted ADR to change its decision.** Write a new one that supersedes it, mark the
old one, and leave the reasoning intact. The record of a reversal is more valuable than a tidy
history.

**An ADR is the one exception to the no-new-documents rule** ([README](../../README.md)). A decision
that is not written down is a decision that gets made again.

Use [0000-template.md](0000-template.md).
