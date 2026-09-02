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
customer host, copying a database dump to a laptop, or configuring a hosted model endpoint where the
customer expected a local one. Countered by redaction before persistence, by configuration that fails
closed, and by making the safe path the default and the unsafe path a deliberate act with a warning.
**Hosted operation raises this considerably**: a dump on a laptop now contains several organisations'
source, and a platform operator with database access bypasses row-level security entirely
([18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)).

**A6 — A chat participant.** New with [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md).
Somebody in a channel the system watches, writing text that reaches a model. They differ from A2 —
repository content — in the way that matters: **they are interactive.** Repository content gets one
shot; a chat participant can probe the triage, learn what it accepts, and try again, dozens of times,
for free from their point of view. They may also be a guest, a contractor or somebody added to a
channel by a person who had no idea the channel controlled anything.

Countered by an authorisation architecture rather than by triage cleverness
([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)):

- an unmapped identity cannot create a request at all, and channel membership is never an entitlement
  ([FR-107](../01-product/03-functional-requirements.md));
- a mapped identity cannot exceed its per-request or per-period allowance
  ([FR-110](../01-product/03-functional-requirements.md));
- the Triager has **no repository access**, so triage cannot be used as a repository-reading oracle
  ([16-agent-role-model.md](16-agent-role-model.md));
- triage output is a **class selection and parameters**, never a plan and never a command — so the
  worst outcome of a successful injection is a Run of a class the requester was already entitled to
  invoke, with parameters they could have supplied directly;
- what can be posted back is a per-field allowlist
  ([FR-114](../01-product/03-functional-requirements.md)), so the channel cannot be used to read source
  out of the system.

**A7 — A tenant of the same hosted deployment.** New with
[ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), and the most
consequential addition: a legitimate customer with valid credentials, whose interest is another
customer's source. This adversary did not exist under single tenancy and their success is not an
incident but an extinction event. Countered by `tenant_id NOT NULL` with row-level security, tenant
resolution from the principal rather than the request, tenant-prefixed artifacts, one Sandbox per Run,
and [NFR-029](../01-product/04-non-functional-requirements.md)'s seeded cross-tenant corpus — and the
open question of whether the execution boundary itself is sufficient is **OQ-10**.

Deliberately **out of scope**: a hostile hypervisor, physical access, supply-chain compromise of the
isolation runtime itself, and nation-state-grade side-channel attacks. Saying so is better than
implying protection that has not been engineered.

**A hostile platform administrator is out of scope and worth naming explicitly**, because hosted
operation makes it a real question rather than a theoretical one. Row-level security constrains the
application's principals, not a person holding database credentials. The controls there are operational
— least-privilege database roles, audited access, and the disclosure commitment below — and they are
not equivalent to the architectural controls above. A customer for whom that distinction is
disqualifying should be self-hosted, and telling them so is the honest answer.

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| **C1 Secret** | Model API keys, repository app credentials, chat platform tokens, object-store keys | Host secret store only, per tenant. Never in a Sandbox, never in an API response, never in a log, registered with the redactor at startup |
| **C2 Customer source** | Repository content, patches, diffs, repo maps, verification output, **finding bodies**, **evidence records** | Stays on the host; reaches configured model endpoints only; **never posted to a chat platform** ([FR-114](../01-product/03-functional-requirements.md)); never written to any other third party by us |
| **C3 Operational** | Events across all three logs, ledger, execution records, git operations, metrics | Stays on the host, tenant-scoped; exportable by the customer within their own tenant |
| **C4 Public** | Documentation, schemas, this specification | No restriction |

Two additions to the classification are worth stating because they are the ones most likely to be got
wrong. **A finding body is C2** — it quotes and describes source, so it may reach the git host where
the code already is, and may not reach a chat channel. **An evidence record is C2** — it contains a test,
a command and its output. What may go to chat is a *count* of findings, never their content.

The rule that follows and that must not be quietly bent: **C2 leaves the host only through a model
endpoint the operator explicitly configured, or to the git host that already holds the code.** There is
still no telemetry, no crash reporting, no usage analytics and no error aggregation service in the
default install.

> **One claim in the previous version no longer holds.** It said "an air-gapped deployment is therefore
> genuinely air-gapped rather than mostly air-gapped, and that is a claim we can survive being audited
> on." Air-gapped operation has moved to deferred scope
> ([01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md)): chat egress, inbound
> ingestion and hosted operation each require connectivity. **Do not describe a deployment as
> air-gapped.** What survives, and is still auditable, is the narrower claim: a deployment can be
> configured so that source reaches nothing but the customer's own model endpoint and their own git
> host.

**In a hosted deployment, C2 belongs to several organisations and is held by us.** That is an
obligation rather than a control, and it is the largest change this document has undergone
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)). Backups contain it.
Support contains it. The compliance questions OQ-02 records stop being a customer's problem and become
ours.

## Controls

| Area | Control | Evidence |
| --- | --- | --- |
| Execution isolation | Non-host kernel boundary, fail-closed if unavailable | [NFR-002](../01-product/04-non-functional-requirements.md), escape suite |
| Network | No network during verification; egress decisions recorded | [NFR-006](../01-product/04-non-functional-requirements.md), [NFR-007](../01-product/04-non-functional-requirements.md) |
| Credentials | Never present in a Sandbox; scanned for actively | [NFR-005](../01-product/04-non-functional-requirements.md) |
| Delivery | Never pushes to a default branch; never pushes without recorded human approval | [FR-031](../01-product/03-functional-requirements.md), [FR-032](../01-product/03-functional-requirements.md) |
| **Repository authority** | Own application installation, never a human's token; a printable permission envelope enforced where requests are constructed, with one test per prohibition | [ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md), [FR-122](../01-product/03-functional-requirements.md), [FR-123](../01-product/03-functional-requirements.md), [NFR-035](../01-product/04-non-functional-requirements.md) |
| **Revocation** | One action at the git host, effective without our cooperation; affected work parks and is never retried | [FR-126](../01-product/03-functional-requirements.md) |
| **Tenant isolation** | `tenant_id NOT NULL` with row-level security; tenant from the principal, never the request; tenant-prefixed artifacts; one Sandbox per Run | [FR-140](../01-product/03-functional-requirements.md), [FR-141](../01-product/03-functional-requirements.md), [NFR-029](../01-product/04-non-functional-requirements.md), INV-10 |
| **Chat egress** | Per-field posting allowlist; every post a recorded egress decision; disableable per deployment | [FR-114](../01-product/03-functional-requirements.md), [NFR-036](../01-product/04-non-functional-requirements.md) |
| **Chat authority** | Entitlements administered per identity; channel membership confers nothing; the Triager has no repository access | [FR-107](../01-product/03-functional-requirements.md) |
| **Ingestion** | Inbound triggers authenticated and signed, recorded before acting, idempotent on the delivery id; endpoints do no work | [FR-116](../01-product/03-functional-requirements.md), [NFR-033](../01-product/04-non-functional-requirements.md) |
| **Approval authority** | An approval policy binds scope, lane and class to permitted principals; self-approval of one's own request is forbidden by default | [FR-135](../01-product/03-functional-requirements.md) |
| Privilege escalation via CI | Patches touching CI configuration, git hooks or submodules are rejected; the credential cannot read CI secrets | `GUARD_PATCH_POLICY`, [FR-036](../01-product/03-functional-requirements.md), [FR-123](../01-product/03-functional-requirements.md) |
| Authentication | Bearer service keys hashed at rest; console sessions through an identity provider in hosted mode (OQ-23) | [03-api-design.md](03-api-design.md), [FR-146](../01-product/03-functional-requirements.md) |
| Authorisation | Role checked per endpoint; `auditor` read-only; `requester` sees only their own requests; `platform` administers tenants and can read none of their data | Contract tests per endpoint and role |
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

Three added by the 2026-09 vision change, and the first is now the most material in the document:

**In a hosted deployment, one escape is a breach of every tenant on that host.** The boundary is a
user-space kernel, so a Sentry vulnerability compromises the host, and the host holds several
organisations' source. Whether that boundary is sufficient for multi-tenant execution is **OQ-10**, it
is unresolved, and it is open in the direction of hardware isolation. **We do not have the option of
weakening the boundary to make hosting affordable**: if it is insufficient, hosted operation is
suspended ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md), revisit
trigger). Until OQ-10 is answered, this is the honest sentence to give a hosted prospect.

**A platform administrator with database credentials bypasses tenant isolation.** Row-level security
constrains the application's principals, not a person holding the credentials. The controls there are
operational rather than architectural, and a customer for whom that is disqualifying should be
self-hosted ([18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)).

**Advisory findings have no correctness guarantee and are delivered into the customer's review
process.** A `demonstrated` finding can be wrong — a failing test may be testing behaviour the
maintainer deliberately does not support — and the reader's trust in the exit code may transfer to the
judgement wrapped around it ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)). This is a
product risk rather than a security one, and it is listed here because it is the thing a reviewer
should be told rather than discover.

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
during the window — is a SQL query over `run_events`, `sandbox_execs`, `egress_events` and now
`git_operations` ([FR-128](../01-product/03-functional-requirements.md)). That it is a query rather than
an investigation is the entire return on the audit design.

**In a hosted deployment the blast-radius question acquires a second dimension: which tenants.** That
is the same query with the tenant predicate removed, run by a platform principal, and it is the one
legitimate cross-tenant read in the system. It is worth naming because the containment step above says
"do not delete anything" — and the instinct to isolate one tenant's data during an incident is exactly
the action that destroys the evidence needed to bound the others.

**Disclose.** For a security-positioned product sold to security reviewers, a concealed incident is
worse than the incident. Notify affected customers with the timeline, the blast radius from the log,
and what was and was not reached. Commit to this before it happens, when it is easy to agree to. **In a
hosted deployment this means notifying every tenant whose data was within the blast radius, not only
the one where the incident was detected**, and that is a commitment worth making now rather than
negotiating during an incident.

**Remediate.** Patch, then add a permanent case to the escape suite or a permanent fixture to the
replay corpus. An incident that does not produce a test will happen again.
