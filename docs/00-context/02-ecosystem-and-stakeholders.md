# Ecosystem and stakeholders

## Who does what

The system sits between parties whose interests only partly overlap, and most of the design tension
comes from that gap.

The **buyer's engineering organisation** wants throughput: more changes shipped without more
headcount. The **buyer's security function** wants a boundary it can inspect and a log it can
question; it has an absolute veto and it exercises it by default. The **operator** — the founder for a
hosted deployment, a platform engineer at the customer for a self-hosted one — wants the thing to run
without becoming a second job.

The 2026-09 vision change added two constituencies that did not exist before, and both change the
design rather than only the feature list. The **non-developer requester** has the problem and no
commit access; they are reached through a chat platform or not at all
([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)). The **tenant
administrator** decides who may invoke what, against which repositories, under whose budget — a
decision that previously did not exist because there was one API key and one operator
([01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md)).

A design that satisfies engineering and not security never gets installed. A design that satisfies
security and not the operator gets installed once, breaks, and is uninstalled. A design that satisfies
both and cannot be reached by the person with the problem serves fewer people than it could. The first
two are gates; the third is the addressable market, and that is why
[02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md) and
[02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)
carry disproportionate depth relative to feature documents.

## Where data lives

This is the first question a security reviewer asks, so the answer is a design constraint rather
than a deployment detail. **Host** below means the host of whichever deployment is in question: the
customer's, for a self-hosted install; ours, for a hosted tenant
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).

| Data | Location | Leaves the host? |
| --- | --- | --- |
| Customer source code | Git working copies on the host; ephemeral copies inside Sandboxes | Only as prompt content, only to the model endpoints the operator configured |
| Run and worksite events, audit log, cost ledger | Postgres on the host, `tenant_id` scoped with row-level security | Never |
| Artifacts (patches, test reports, evidence records, logs) | Content-addressed object store on the host, under a tenant prefix | Never |
| Findings | Postgres on the host; rendered as pull-request comments on the target repository | Finding bodies reach the git host by design; **never** a chat platform ([FR-108](../01-product/03-functional-requirements.md)) |
| Requests and chat messages | Postgres on the host | Status, links and counts are posted back to the originating chat platform on an allowlist |
| Prompts and completions | Transient; a redacted record is stored locally | Prompt content reaches the configured model endpoint |
| Secrets (repository app credentials, model API keys, chat tokens) | Host secret store, injected into the control plane only | Never enter a Sandbox |

Two consequences worth stating separately, because the vision change moved one of them.

**A deployment configured with only local model endpoints emits no source-derived byte to a model
vendor.** That is why the model layer is an abstraction rather than a vendor integration
([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)), and it is unchanged.

**It is no longer the same thing as air-gapped.** Chat egress, inbound ingestion and hosted operation
each require connectivity, so air-gapped operation has moved from a supported first-class mode to
deferred scope ([01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md)). A deployment
can still be configured so that source reaches nothing but the customer's own model endpoint; it cannot
be described as air-gapped while a chat integration is enabled.

**In a hosted deployment we hold other organisations' source code.** ADR-0021's negative section states
this plainly and it is the single largest change to this document: backups contain it, support contains
it, and the compliance obligations OQ-02 records stop being a customer's problem and become ours.

> **Open question OQ-01** — Which deployment shape **v1 targets first**: hosted by us, or self-hosted
> by the customer. Both are supported and the architecture must not assume either
> ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)); building and
> supporting both simultaneously is not affordable for a single maintainer, so one has to be first.
> The trade: **hosted** means we operate it, see production, upgrade daily and get feedback fastest, and
> we take on holding customers' source; **self-hosted** means an installer, an upgrade path, several
> versions in the field, and debugging environments we cannot see. **Blocks:** the roadmap's milestone
> ordering, the identity-provider decision (OQ-23), whether the billing surface is needed for first
> revenue (OQ-06), and how much of [02-architecture/18-deployment-and-tenancy.md](../02-architecture/18-deployment-and-tenancy.md)
> is exercised first. Does **not** block the schema, because tenancy is enforced in both.
> **Resolved by:** the founder naming which shape the first paying deployment is.

> **Open question OQ-15** — Whether the security-perimeter argument — "your source never leaves your
> infrastructure" — remains the **primary** selling point, becomes a **secondary** one, or is
> **dropped**. The previous positioning made it primary and the whole of the previous problem statement
> was built on it. The new vision is broader, and a hosted multi-tenant service cannot lead with it at
> all. **Blocks:** the emphasis of [01-problem-and-vision.md](01-problem-and-vision.md), how much
> depth [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)
> carries relative to the effectiveness dashboard, and whether the isolation boundary is still the
> first milestone. Does **not** block any engineering decision: the boundary is required by
> [UF-1](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) regardless of whether
> it is what we sell on. **Resolved by:** the founder stating it, ideally after the first three sales
> conversations rather than before.

## Environmental reality driving engineering

Two environments now matter, and the constraints compose rather than cancel
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)): the hosted deployment
inherits "must run on a customer's single host with four process kinds", and the self-hosted
installation inherits "must be safe with several tenants". The paragraphs below describe the
self-hosted environment, which is the more constraining of the two and therefore the one that sets the
engineering budget.

The self-hosted operator's environment is not a laptop and not a hyperscaler. It is on-premise
virtualisation — the intake names Proxmox — with these consequences:

**KVM may not be nested-available, and GPUs may not exist.** The isolation choice cannot assume
hardware virtualisation is exposed to the workload VM, which is one of the two reasons v1 uses a
user-space kernel rather than microVMs ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)).
Local model inference cannot be a hard dependency, because whether suitable GPUs exist is unknown
(OQ-04).

**Egress may be restricted or absent.** Dependency installation cannot be assumed to work at run
time. This is why the sandbox image is built ahead of time with dependencies baked in and pinned, and
why the verification sandbox runs with no network at all
([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md)).

**There is no operations team.** One person installs, upgrades, and debugs it, usually while doing
something else. This makes "few moving parts" a correctness property rather than an aesthetic
preference: it is the reason for one database instead of a database plus a queue plus a cache, and
the reason the alert budget in
[02-architecture/12-observability-and-slos.md](../02-architecture/12-observability-and-slos.md) is
capped at a number a single human can absorb.

**Connectivity between operator and system is a LAN or a VPN.** Nobody uses this from a phone, on a
train, or offline. There is no synchronisation problem to solve, which is why no sync document
exists. This survives the vision change: the console is a server-rendered surface for a desktop
browser ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)), and the requester's only
mobile-adjacent surface is their own chat client, which we do not build.

**Inbound connectivity is now a requirement or a configured trade.** Reacting to a pull request
requires either an inbound path from the git host or polling, and a self-hosted install behind a
firewall may only be able to do the second — with the latency consequence stated rather than hidden
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). This is a new
dependency on the customer's network posture that the previous request-oriented design did not have.

## Per-stakeholder gaps

What each party is missing today, and the specific mechanism that closes it. If a mechanism has no
stakeholder, it is scope creep; if a stakeholder has no mechanism, the product does not serve them.

| Stakeholder | Gap today | Mechanism |
| --- | --- | --- |
| Lead developer at the buyer | Cannot delegate a change without reviewing it as if written blind | Every Run produces a diff, a passing verification command, and an attempt trail ([02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)) |
| Lead developer at the buyer | Review comments from tools cost more attention than they save | Advisory findings carry executable evidence or are labelled *unverified*, and the two are never rendered alike ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)) |
| Security reviewer at the buyer | Cannot answer "what did it execute, and where could our code go" | Append-only event log of every exec and model call ([02-architecture/09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)); enforced egress allowlist ([02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)) |
| Security reviewer at the buyer | Cannot bound what a tool with write access could do to their repository | A printable permission envelope enforced where requests are constructed, revocable in one action without our cooperation ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)) |
| Engineering manager / budget holder | Cannot predict cost per unit of work | Per-Run and per-worksite ceilings enforced before each model call, with a full ledger ([02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)) |
| Engineering manager / budget holder | Cannot tell whether the tool paid for itself, and every vendor reports activity instead | Effectiveness dashboard: acceptance rate, cost per merged pull request, intervention rate, time to merge — per lane and per class, from the event log, with the count each figure was computed from ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)) |
| Tech lead owning a migration | A campaign spanning weeks lives in a spreadsheet and stalls when its champion moves team | Worksites: a declared campaign with a remaining count measured on merged state, durable pause and resume, and four ceilings ([01-product/07-worksites.md](../01-product/07-worksites.md)) |
| Non-developer requester | Notices a defect, has no commit access, and the request dies in a chat thread | A brokered request in the channel they already use, with an honest decline and a reason when nothing fits ([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)) |
| Tenant administrator | Cannot say who may spend what against which repository | Entitlements, per-team and per-repository budgets, and an approval policy binding scope and lane to principals ([01-product/09-web-interface-and-admin-console.md](../01-product/09-web-interface-and-admin-console.md)) |
| Platform operator | Cannot run an agent stack without adopting a cloud dependency | Four process kinds, Postgres plus object store plus sandbox runtime, no broker and no Kubernetes ([02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)) |
| Founder (hosted operator) | Cannot iterate without burning their own budget | Tiering and hard ceilings at four levels, defaults set conservatively ([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)) |

## Competitive frame

Taken from the intake and treated as the positioning premise rather than as verified market data. The
column that matters is the last one: it names the property M.A.D.E. must hold to be a different
product rather than a worse copy.

| Category | Example named in the intake | What it does well | The gap M.A.D.E. targets |
| --- | --- | --- | --- |
| Autonomous cloud agent | Devin | Long-horizon planning, opens pull requests | Opaque execution; usage-metered billing turns reasoning errors into cost; pushes forward when it should stop |
| Browser prototyper | Bolt.new, Lovable, Replit AI Core | Idea to running frontend very fast | No deployment pipeline, no container topology, no path to a production estate |
| Open-source generalist agent | OpenHands | Model-agnostic, transparent, human-in-the-loop | Single generalist agent rather than specialised roles; isolation is left to the operator |
| Multi-agent framework | AutoGen, CrewAI, MetaGPT | Role structures and delegation | Conversation-driven termination; code execution and sandboxing are secondary concerns |

The strategic conclusion the intake draws: do not compete on prototyping speed. Compete on execution
isolation, deployment artifacts as a first-class output, and the ability to run entirely inside the
customer's perimeter.

> **Partly reopened by the 2026-09 vision change.** The third clause is exactly the perimeter argument
> that **OQ-15** puts back on the table, and a hosted multi-tenant deployment cannot make it at all.
> No replacement positioning is invented here, because the material to support one has not been
> supplied. What the architecture supports as differentiators, stated as capabilities rather than as
> market claims: unattended execution with enforced ceilings, a complete audit trail, advisory output
> that carries evidence rather than opinion
> ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)), campaigns that measure progress on
> merged state ([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)), and honest
> effectiveness reporting ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). Which of
> those leads is a positioning decision for the founder, and no document here should assert one.

## Claims carried from the intake (unverified)

The intake contains third-party performance, pricing and benchmark figures. They are recorded here
once, marked, and never repeated as fact elsewhere in this specification. **No decision in this
repository depends on any of them being true** — this is deliberate, because several are the kind of
figure that ages in weeks.

| Claim, as supplied | Where the intake used it | Status here |
| --- | --- | --- |
| Autonomous-agent success rates of 15–30% | Motivating the verification gate | Unverified. Used only as narrative motivation; the gate is justified by [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) independently. |
| Firecracker cold start under 125 ms; ~5 MB memory overhead; six emulated devices | Sandbox comparison | Unverified. v1 does not use Firecracker ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)); the figure informs no v1 budget. |
| Snapshot-fork clone in ~56 ms (forkd / ZeroBoot) | Sandbox comparison | Unverified. Out of v1 scope entirely. |
| gVisor boot ≈ 1 s | Sandbox comparison | Unverified as a general figure. [NFR-001](../01-product/04-non-functional-requirements.md) sets our own measured budget on our own image; the intake number is not the budget. |
| LangGraph checkpointer throughput: SQLite ≈ 7,083 ops/s, Postgres ≈ 1,038 ops/s | Arguing checkpointer choice | Unverified; no benchmark conditions supplied. [ADR-0003](../03-adr/0003-postgres-as-system-of-record.md) chooses Postgres on transactional grounds, and explicitly does not rely on these numbers. Our own workload is far below either figure ([NFR-017](../01-product/04-non-functional-requirements.md)). |
| Model quality and price figures (HumanEval / SWE-bench percentages, per-token prices, local tokens-per-second) | Model selection | Unverified, and model catalogues move faster than this document. The architecture references capability **tiers**, never a model name ([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)). See OQ-05. |
| Ramp's engineering team uses ephemeral isolated environments for its agents | Precedent for the isolation posture | Reported in the intake; not independently verified. Carries no design weight. |

> **Open question OQ-05** — The concrete model, endpoint and price for each capability tier at
> implementation time. **Blocks:** the default configuration shipped in `config/models.example.yaml`
> and any published cost-per-run figure. **Resolved by:** the founder benchmarking two candidates per
> tier on the golden task suite ([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md))
> and recording measured cost and pass rate. Until then the tier defaults stay unset and the system
> refuses to start without an explicit model configuration ([FR-041](../01-product/03-functional-requirements.md)).
