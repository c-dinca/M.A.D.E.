# Architecture decision records

An ADR exists so that a settled question is not re-litigated, and so that an agent encountering a rule
understands the constraint behind it. It is not a changelog and it is not a design document; it records
one decision, the alternative it beat, and the price paid.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-python-312-orchestrator-language.md) | Python 3.12 for the control plane and agent layer | Accepted |
| [0002](0002-langgraph-as-executor-with-pure-routing.md) | LangGraph executes the graph; routing predicates stay pure and ours | Accepted |
| [0003](0003-postgres-as-system-of-record.md) | PostgreSQL is the single system of record, including the checkpointer | Accepted |
| [0004](0004-event-log-separate-from-checkpoints.md) | Our event log is the audit source; framework checkpoints are a resumption cache | Accepted |
| [0005](0005-gvisor-v1-firecracker-deferred.md) | gVisor is the v1 isolation boundary; Firecracker is deferred behind a provider seam | Accepted |
| [0006](0006-no-network-in-verification-sandbox.md) | Verification runs with no network; dependencies are baked into a pinned image | Accepted |
| [0007](0007-git-worktree-as-project-state.md) | Git holds project state; the graph state holds references, never file contents | Accepted |
| [0008](0008-search-replace-patch-format.md) | Edits are exact-match search/replace blocks | Accepted |
| [0009](0009-tool-mediated-retrieval-no-vector-db.md) | Structural retrieval and a repo map; no vector index in v1 | Accepted |
| [0010](0010-termination-guards.md) | Six layered termination guards, including a progress oracle | Accepted |
| [0011](0011-durable-human-approval-gates.md) | Human approval is a durable state, and delivery approval is mandatory | Accepted |
| [0012](0012-model-tiers-and-provider-abstraction.md) | Capability tiers with an OpenAI-compatible adapter; no default model | Accepted |
| [0013](0013-single-tenant-self-hosted-v1.md) | Single-tenant, self-hosted, four processes, one operator | **Superseded by ADR-0021** |
| [0014](0014-verification-oracle-is-authoritative.md) | The verification exit code is the sole definition of Task success | Accepted |
| [0015](0015-credential-brokering-no-secrets-in-sandbox.md) | Sandboxes hold no credentials; git writes happen control-plane side | Accepted |
| [0016](0016-server-rendered-run-viewer.md) | Server-rendered run viewer; no single-page application in v1 | **Superseded by ADR-0028** |
| [0017](0017-content-addressed-artifact-store.md) | Artifacts are content-addressed in an object store, not blobs in Postgres | Accepted |
| [0018](0018-spec-as-contract-and-spec-lint.md) | Contracts are normative and enforced by a spec-lint CI gate | Accepted |
| [0019](0019-specification-first-projects.md) | Specification-first Projects: a generated specification bundle as a Run's first output | **Withdrawn by ADR-0020** |
| [0020](0020-technical-debt-remediation-as-the-v1-product.md) | Technical-debt remediation on existing repositories is the v1 product; work classes replace generated planning | Accepted |
| [0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md) | One deployment-agnostic core serving both self-hosted and hosted multi-tenant operation | Accepted |
| [0022](0022-two-lanes-verified-and-advisory.md) | Work is separated into a verified lane and an advisory lane, and both ship in v1 | Accepted |
| [0023](0023-advisory-findings-carry-evidence.md) | An advisory finding carries executable evidence or is marked unverified | Accepted |
| [0024](0024-worksites-as-long-running-campaigns.md) | A worksite is a bounded long-running campaign measuring progress on merged state | Accepted |
| [0025](0025-chat-front-door-request-broker.md) | A chat request is brokered into an entitled work class or declined | Accepted |
| [0026](0026-resident-agents-event-ingestion-visible-queues.md) | Residency is a control-plane property: durable ingestion and visible queues, not immortal agents | Accepted |
| [0027](0027-scoped-application-identity-branches-only.md) | The system authenticates as its own scoped application installation; branches and pull requests only | Accepted |
| [0028](0028-web-console-as-a-product-surface.md) | The web console is a product surface with an effectiveness dashboard; rendering stays server-side | Accepted |

## The 2026-09 vision change

ADR-0021 through ADR-0028 were written together, in one revision, after the founder substantially
changed the product vision. They are not independent: reading any one of them without
[ADR-0022](0022-two-lanes-verified-and-advisory.md) (the lane split) and
[ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md) (deployment shape) will give a
misleading picture, because those two are what the others assume. What changed, what was reversed and
what is now open is recorded in
[00-context/06-vision-change-2026-09.md](../00-context/06-vision-change-2026-09.md).

Two earlier decisions were superseded and none was deleted: ADR-0013 (tenancy reversed, process and
alert ceilings retained) and ADR-0016 (interface scope widened, display rules and rendering technology
retained). [ADR-0020](0020-technical-debt-remediation-as-the-v1-product.md) survives and is
**narrowed rather than replaced**: the verified lane is still exactly what it describes, and generated
planning is still deferred — see OQ-19.

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
becomes a problem" is not a trigger. The point is that an agent hitting the trigger knows the decision
is now open rather than sacred.

**Never edit an accepted ADR to change its decision.** Write a new one that supersedes it, mark the old
one `Superseded by ADR-XXXX`, and leave the reasoning intact. The record of a reversal is more valuable
than a tidy history.

## Status values

`Proposed` — written but not agreed. `Accepted` — in force; the codebase must comply.
`Superseded by ADR-XXXX` — historical, retained for its reasoning. `Withdrawn` — proposed and
abandoned, with the reason recorded.

Use [0000-template.md](0000-template.md).
