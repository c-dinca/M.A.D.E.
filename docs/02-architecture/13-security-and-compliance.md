# Security and compliance

The mechanism for [UF-4](01-system-overview.md#the-five-unforgivable-failures), and the customer-facing
half of [UF-1](01-system-overview.md#the-five-unforgivable-failures). The technical isolation boundary
is specified in [04-execution-isolation.md](04-execution-isolation.md); this document covers
adversaries, data handling, the control set as a reviewer will ask for it, and what happens when
something goes wrong.

The buyer's security function holds a veto ([00-context/02-ecosystem-and-stakeholders.md](../00-context/02-ecosystem-and-stakeholders.md)).
This document is written to be handed to that person.

## Named adversaries

Threat modelling in the abstract produces control lists nobody uses. These are the five actors whose
capabilities actually shape the design.

**A1 — The model itself, acting badly.** Not malicious in intent, but capable of generating
destructive commands, deleting unrelated code, or executing something catastrophic because a
plausible-looking instruction appeared in its context. It has no persistence and no goal, which makes
it the least sophisticated adversary and the most frequent one. Countered by the isolation boundary,
the absence of a shell tool, the patch policy validator, and the fact that every write is a reviewed
patch.

**A2 — A poisoned dependency or a crafted repository file.** Content the model reads that contains
instructions: a README telling the agent to exfiltrate, a test docstring telling it to disable checks,
a package whose install script phones home. It has no privileges of its own; it borrows the agent's.
Countered by the authority model ([06-verification-and-truthfulness.md](06-verification-and-truthfulness.md)),
by the Sandbox having no network during verification, and by dependencies being installed at image
build time rather than at run time.

**A3 — A malicious or compromised submitter.** Someone with a `submitter` key who wants the system to
do something it should not: touch the default branch, exceed a budget, exfiltrate through a crafted
request. Countered by role separation, by ceilings the submitter cannot raise, by the default-branch
prohibition holding even against explicit instruction
([FR-031](../01-product/03-functional-requirements.md)), and by every action being attributable to a
key in the audit log.

**A4 — An attacker on the operator's network.** Reached the LAN and can talk to the control plane.
Countered by API-key authentication, by secrets never being readable through the API, by the absence of
an arbitrary-execution endpoint, and by the append-only log making tampering visible. Note honestly:
v1 assumes the deployment sits inside a network the customer controls. It is not designed to be exposed
to the public internet, and the documentation must say so rather than implying a hardening it lacks.

**A5 — A curious or careless operator.** Not an attacker, but capable of enabling debug logging on a
customer host, copying a database dump to a laptop, or configuring a hosted model endpoint at an
air-gapped customer. Countered by redaction before persistence, by configuration that fails closed, and
by making the safe path the default and the unsafe path a deliberate act with a warning.

Deliberately **out of scope for v1**: a hostile hypervisor or host administrator, physical access,
supply-chain compromise of the isolation runtime itself, and nation-state-grade side-channel attacks.
Saying so is better than implying protection that has not been engineered.

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| **C1 Secret** | Model API keys, repository credentials, object-store keys | Host secret store only. Never in a Sandbox, never in an API response, never in a log, registered with the redactor at startup |
| **C2 Customer source** | Repository content, patches, diffs, repo maps | Stays on the host; reaches configured model endpoints only; never written to a third party by us |
| **C3 Operational** | Events, ledger, execution records, metrics | Stays on the host; exportable by the customer |
| **C4 Public** | Documentation, schemas, this specification | No restriction |

The rule that follows and that must not be quietly bent: **C2 leaves the host only through a model
endpoint the operator explicitly configured.** There is no telemetry, no crash reporting, no usage
analytics and no error aggregation service in the default install. An air-gapped deployment is
therefore genuinely air-gapped rather than mostly air-gapped, and that is a claim we can survive being
audited on.

## Controls

| Area | Control | Evidence |
| --- | --- | --- |
| Execution isolation | Non-host kernel boundary, fail-closed if unavailable | [NFR-002](../01-product/04-non-functional-requirements.md), escape suite |
| Network | No network during verification; egress decisions recorded | [NFR-006](../01-product/04-non-functional-requirements.md), [NFR-007](../01-product/04-non-functional-requirements.md) |
| Credentials | Never present in a Sandbox; scanned for actively | [NFR-005](../01-product/04-non-functional-requirements.md) |
| Delivery | Never pushes to a default branch; never pushes without recorded human approval | [FR-031](../01-product/03-functional-requirements.md), [FR-032](../01-product/03-functional-requirements.md) |
| Privilege escalation via CI | Patches touching CI configuration, git hooks or submodules are rejected | `GUARD_PATCH_POLICY`, [FR-036](../01-product/03-functional-requirements.md) |
| Authentication | Bearer keys, hashed at rest, three roles | [03-api-design.md](03-api-design.md) |
| Authorisation | Role checked per endpoint; auditor role is read-only | Contract tests per endpoint and role |
| Audit | Append-only, complete, exportable | [NFR-015](../01-product/04-non-functional-requirements.md), [NFR-016](../01-product/04-non-functional-requirements.md) |
| Secret hygiene | Redaction before persistence across logs, events, artifacts and prompts | [NFR-008](../01-product/04-non-functional-requirements.md) |
| Supply chain (ours) | Dependencies pinned by hash; image digests pinned; vulnerability scan in CI | [04-engineering/06-ci-cd.md](../04-engineering/06-ci-cd.md) |
| Supply chain (theirs) | Dependencies installed at image build, not at run time; image digest recorded per Run | [FR-060](../01-product/03-functional-requirements.md), [FR-061](../01-product/03-functional-requirements.md) |
| Patch SLO | Isolation runtime and base image patched within 7 days for high/critical | [NFR-004](../01-product/04-non-functional-requirements.md) |

## Honest statement of residual risk

A specification that claims no residual risk is not credible to the person reading it. Three are
material and are stated to customers in these words:

**The isolation boundary is a user-space kernel, not hardware virtualisation.** A vulnerability in the
sandbox runtime's Sentry is a host compromise. This is a deliberate v1 trade for operability
([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)), mitigated by the patch SLO, and the
migration path to hardware isolation is specified.

**The control plane and the sandbox runtime share a host in the default install.** A successful escape
therefore reaches the control plane. Mitigated by the escape suite and by the worker holding secrets in
memory rather than on disk; removed entirely when sandbox execution moves to a separate host pool
([11-infrastructure-and-devops.md](11-infrastructure-and-devops.md)).

**Customer source reaches whatever model endpoint the operator configures.** If that is a hosted
vendor, the vendor's terms apply and we have no control over them. The system makes this visible and
configurable; it cannot make it safe on the customer's behalf.

## Regulatory position

> **Open question OQ-02** — The compliance obligations of the first customers: GDPR applicability, any
> audit-record retention minimum, data-residency constraints, and whether a SOC 2 report will be asked
> for. The intake did not state a regulatory context and none is invented here. **Blocks:** the default
> retention configuration, any compliance claim in customer material, and whether a formal control
> mapping is needed. Does **not** block implementation. **Resolved by:** the founder confirming the
> first design partner's requirements.

What the architecture provides regardless of the answer, because these are cheap now and expensive to
retrofit: a complete audit trail with actor attribution; data that stays on the customer's host by
default; retention as a configured value with a working deletion path; least-privilege credentials that
are ref-scoped and short-lived; and a documented incident process. If a formal regime applies, the
mapping is documentation work rather than engineering work — which is the point of doing it this way.

**Personal data.** The system processes repository content, which may incidentally contain personal
data (author names in git history, test fixtures). It does not deliberately collect any, stores no
end-user records, and has no `users` table ([02-data-model.md](02-data-model.md)). Actor identity is an
API key label chosen by the operator.

## Incident response

Sized for one person, so it must be executable while tired.

**Detect.** Sources: escape suite failure, audit reconciliation mismatch, unexpected egress denials,
authority violations in evaluation, or a customer report.

**Contain.** Stop accepting new Runs (`make pause`), let in-flight Runs park, and if isolation is
implicated destroy all Sandboxes and stop the worker. Do not delete anything: the event log is the
evidence, and the first instinct to "clean up" destroys the investigation.

**Assess.** The blast-radius question — which Runs touched which repositories with which tool calls
during the window — is a SQL query over `run_events`, `sandbox_execs` and `egress_events`. That it is a
query rather than an investigation is the entire return on the audit design.

**Disclose.** For a security-positioned product sold to security reviewers, a concealed incident is
worse than the incident. Notify affected customers with the timeline, the blast radius from the log,
and what was and was not reached. Commit to this before it happens, when it is easy to agree to.

**Remediate.** Patch, then add a permanent case to the escape suite or a permanent fixture to the
replay corpus. An incident that does not produce a test will happen again.
