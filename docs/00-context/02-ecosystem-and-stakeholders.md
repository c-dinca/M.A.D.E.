# Ecosystem and stakeholders

## Who does what

The system sits between three parties whose interests only partly overlap, and most of the design
tension comes from that gap.

The **buyer's engineering organisation** wants throughput: more changes shipped without more
headcount. The **buyer's security function** wants a boundary it can inspect and a log it can
question; it has an absolute veto and it exercises it by default. The **operator** — in v1 the
founder, later a platform engineer at the customer — wants the thing to run on hardware they already
have, without becoming a second job.

A design that satisfies engineering and not security never gets installed. A design that satisfies
security and not the operator gets installed once, breaks, and is uninstalled. Both constituencies
are gates, not preferences, and that is why
[02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md) and
[02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)
carry disproportionate depth relative to feature documents.

## Where data lives

This is the first question a security reviewer asks, so the answer is a design constraint rather
than a deployment detail.

| Data | Location in v1 | Leaves the host? |
| --- | --- | --- |
| Customer source code | Git working copies on the operator's host; ephemeral copies inside sandboxes | Only as prompt content, only to the model endpoints the operator configured |
| Run events, audit log, cost ledger | Postgres on the operator's host | Never |
| Artifacts (specs, patches, test reports, logs) | Content-addressed object store on the operator's host | Never |
| Prompts and completions | Transient; a redacted record is stored locally | Prompt content reaches the configured model endpoint |
| Secrets (git tokens, model API keys) | Host secret store, injected into the control plane only | Never enter a sandbox |

The consequence: in a deployment configured with only local model endpoints, no source-derived byte
leaves the customer's network. That configuration is a supported first-class mode, not a degraded
one, and it is why the model layer is an abstraction rather than a vendor integration
([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)).

> **Open question OQ-01** — Whether the first paying deployment is self-hosted on the customer's
> infrastructure or hosted by us. The specification assumes self-hosted single-tenant
> ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)) because it is the configuration the
> intake's B2B/BYOC positioning describes and because it removes multi-tenant isolation from the v1
> threat model. **Blocks:** the billing surface, the tenancy columns in the schema, and whether
> [02-architecture/15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md) is a v2
> concern or a v1 one. **Resolved by:** the founder naming the deployment shape of the first
> design-partner install.

## Environmental reality driving engineering

The operator's environment is not a laptop and not a hyperscaler. It is on-premise virtualisation —
the intake names Proxmox — with these consequences:

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
exists.

## Per-stakeholder gaps

What each party is missing today, and the specific mechanism that closes it. If a mechanism has no
stakeholder, it is scope creep; if a stakeholder has no mechanism, the product does not serve them.

| Stakeholder | Gap today | Mechanism |
| --- | --- | --- |
| Lead developer at the buyer | Cannot delegate a change without reviewing it as if written blind | Every run produces a diff, a passing verification command, and an attempt trail ([02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)) |
| Security reviewer at the buyer | Cannot answer "what did it execute, and where could our code go" | Append-only event log of every exec and model call ([02-architecture/09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)); enforced egress allowlist ([02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)) |
| Engineering manager / budget holder | Cannot predict cost per unit of work | Per-run ceiling enforced before each model call, with a full ledger ([02-architecture/07-cost-control.md](../02-architecture/07-cost-control.md)) |
| Platform operator | Cannot run an agent stack without adopting a cloud dependency | Single-host deployment, Postgres plus object store plus sandbox runtime, no Kubernetes ([02-architecture/11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md)) |
| Founder (v1 operator) | Cannot iterate without burning their own budget | Local-model tiering and hard ceilings, defaults set conservatively ([02-architecture/10-llm-integration-and-evaluation.md](../02-architecture/10-llm-integration-and-evaluation.md)) |

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

The strategic conclusion the intake draws, and which this specification adopts: do not compete on
prototyping speed. Compete on execution isolation, deployment artifacts as a first-class output, and
the ability to run entirely inside the customer's perimeter.

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
