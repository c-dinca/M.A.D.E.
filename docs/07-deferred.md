# Deferred

Nothing here is rejected. Every entry is something the specification previously required, or something
the vision needs and v1 does not build, **postponed with a reason** and — where it applies — the scope
that would bring it back ([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)).

Read this before rebuilding anything. The ADRs are kept for exactly this purpose: the design for most
of what is below already exists and is better than a second draft
([03-adr/README.md](03-adr/README.md)).

**Rejected by strategy is different and lives elsewhere** —
[01-product.md](01-product.md#non-goals) holds the non-goals. An agent hitting a non-goal should
refuse it. An agent hitting something here should refuse it *and* know the owner may want it back.

---

## Capability

| Deferred | Why | Reopens when |
| --- | --- | --- |
| **Shows as long-running campaigns** — the survey-and-slice cycle, campaign ceilings, the campaign progress oracle, pause and resume | v1 has one recipe and one Scene at a time. The concept and the term survive in [01-product.md](01-product.md); the driver does not ([ADR-0024](03-adr/0024-worksites-as-long-running-campaigns.md) is the design) | A work class whose unit is bigger than one Preview — which is what [OQ-11](06-open-questions.md) would do if it resolves toward migrations |
| **Show templates** — applying a declared campaign to a new House | A template implies the progress measure and the slice rule generalise across repositories, and nobody has checked whether they do. It is a schema question, so it should not be decided twice | A second House wanting the same campaign unchanged |
| **Multi-repository work** — one Show spanning several Houses | A Scene operates on one House. Batching across several makes failure attribution ambiguous | A client with an estate rather than a repository |
| **Front of House** — the chat entry point | The largest of the deferred capabilities: an inbound surface, an outbound egress path, an entitlement system and a new adversary, for a capability whose value depends on an unresolved question ([ADR-0025](03-adr/0025-chat-front-door-request-broker.md)) | Deliberately after the verified lane works. Its shape is [OQ-19](06-open-questions.md) |
| **Generated planning and the Architect** — turning a free-text request into a specified task | The plan is a declared recipe ([FR-081](03-requirements.md)). A dependency upgrade does not need an architecture agent ([ADR-0032](03-adr/0032-three-actors-two-roles.md)) | [OQ-19](06-open-questions.md) resolving toward the wide chat door. It contradicts FR-081, so it is an ADR, not a feature |
| **Extra agent roles** — Director, Scenarist, Répétiteur, and the QA and DevOps roles | Five specified roles had nothing to do in v1. A role with no work still costs a prompt, a tier, golden cases and an adversarial case ([ADR-0032](03-adr/0032-three-actors-two-roles.md)) | A lane whose output is neither a change to declared paths nor a comment with evidence — which by that ADR's test is a new authority grant |
| **Test generation** — writing the tests a repository is missing | It is a separate lane with a different oracle problem, and a repository with no suite is not a v1 client | After the verified lane is measured, and only if the missing-suite refusal turns out to be costing real clients |
| **Scheduling** — recurring Scenes without a person | v1 is a person starting a Scene. The work recurs by nature, so this is early on the list ([FR-082](03-requirements.md) was the gate) | The first client who does not want to remember |
| **Event-driven residency** — inbound triggers, visible queues, durable scheduling, four-level admission | v1 does not react to events ([ADR-0026](03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). Its refusal of context-carrying agents still binds | Reacting to a Preview being opened, which is the natural trigger for the judgement lane |
| **Self-hosted packaging** — a client operating their own instance | Hosted first ([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)). The instance we operate is the artifact they would run, so this is packaging rather than a second product | A client requiring it, or [OQ-15](06-open-questions.md) resolving toward regulated buyers, in which case it becomes first rather than second |
| **Shared multi-tenant runtime** | One isolated instance per client. Note this is **removed, not deferred**: the machinery is gone from the contracts ([CON-01](04-contracts.md)). ADR-0021 is the design to revive **in full** if it returns — never a partial version | Measured infrastructure cost per client exceeding what the price can carry |
| **MicroVM isolation** | Instance separation removed the cross-client threat, so a container sized to one client's own code is proportionate ([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md)). The provider seam keeps the swap additive | A client requiring hardware-level isolation at a security review |
| **The Booth beyond four pages** — worksite monitoring, a comment queue, budget administration, approval policy, users and teams | Most of them are surfaces for capability that is itself deferred ([ADR-0028](03-adr/0028-web-console-as-a-product-surface.md)) | The capability behind each page |
| **An evaluation harness** — golden tasks, baselines, a regression gate | Real money per run for a statistical signal, before there is anything to regress against | Before the second prompt change that matters |
| **Air-gapped operation** | Egress to a package registry and a model endpoint is required by the lane v1 ships. A deployment can still be configured so source reaches only endpoints the client approved; it cannot be called air-gapped | A client requiring it, at which point it is a configuration profile plus an honest feature matrix |
| **Fork-based delivery** — holding no write access at all | The alternative an external reviewer often prefers, and one module. It lost to the direct-write decision and to cross-fork Previews not running the target's own CI ([ADR-0027](03-adr/0027-scoped-application-identity-branches-only.md)) | A client requiring it as a purchase condition |
| **Pricing** | **Not deferred by choice — missing.** M3 needs a paying client and there is no price. One instance per client means cost per client is not near zero. No number is invented here | Before M3 can complete. It is a decision, not a bet |

## Requirements cut from the verified lane

125 of 150 functional requirements failed the test in [03-requirements.md](03-requirements.md). Grouped
by the reason they went, one line each.

### Removed with shared tenancy — not deferred

One isolated instance per client means there is nothing to separate inside an instance
([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)). If a shared runtime ever returns,
ADR-0021 is the design and all of these come back together.

| ID | Was | Gone because |
| --- | --- | --- |
| FR-140 | `tenant_id NOT NULL` in every constraint and index, with row-level security | No shared runtime |
| FR-141 | The tenant resolved from the authenticated principal | No tenant |
| FR-142 | Exactly one tenant row in a self-hosted deployment | No tenant table |
| FR-143 | No capability present in one deployment mode and not the other | One mode |
| FR-144 | Tenant scope on artifacts, object-store paths, metric labels and log fields | No tenant |
| FR-145 | Users, teams, roles and principals as first-class records | One instance, one client, no team model in v1 |
| FR-146 | An identity provider required in hosted mode | The Booth authenticates per instance; single sign-on is deferred |

### Generated planning and the Architect

All deferred together ([ADR-0032](03-adr/0032-three-actors-two-roles.md)); they reopen with
[OQ-19](06-open-questions.md).

| ID | Was | Gone because |
| --- | --- | --- |
| FR-011 | Accept a request carrying free-text intent | No free-text intake |
| FR-022 | The Architect produces a Spec | No Architect. Also unreferenced |
| FR-023 | A TaskGraph as a directed acyclic graph | No generated plan |
| FR-024 | Reject a task with no verification command | The recipe declares the command |
| FR-025 | Reject a cyclic or oversized graph | No graph |
| FR-026 | A task kind determining which role implements it | Two roles, one recipe |
| FR-027 | Tasks execute one at a time | One Scene, one task |
| FR-028 | A plan-approval gate before implementation | Nothing to approve before the work; The Call is before delivery |
| FR-029 | Ambiguity above a threshold escalates rather than guessing | Nothing to be ambiguous about in a declared recipe |
| FR-030 | A second invalid graph escalates rather than retrying | No graph |

### Configuration, lifecycle and the API surface

| ID | Was | Gone because |
| --- | --- | --- |
| FR-002 | Per-House model tiers, ceilings, caps and TTL | Unreferenced. One recipe and one ceiling, carried by [FR-049](03-requirements.md) |
| FR-003 | Credentials stored by name, never returned by the API | Unreferenced. Covered by [FR-056](03-requirements.md) and ADR-0015 |
| FR-005 | Immutable configuration versions recorded per Scene | One recipe; no configuration history to explain a Scene against |
| FR-006 | List and get Houses | Unreferenced. A Booth page ([CON-06](04-contracts.md)), not a gate |
| FR-007 | Archiving a House while retaining its history | Unreferenced. No House has a history worth retaining yet |
| FR-008 | The execution image pinned by content digest | Reproducible images deferred; the runtime is configured per instance |
| FR-009 | A declared egress allowlist for image build time | Unreferenced. Superseded by [FR-057](03-requirements.md)'s run-time allowlist |
| FR-012 | Each Scene on its own branch named from the base commit | Carried by [FR-123](03-requirements.md)'s reserved prefix plus FR-010 and FR-032 |
| FR-013 | Exactly one state occupied at a time | Unreferenced. A state-machine property ([CON-02](04-contracts.md)) |
| FR-014 | Expose current state, spend and progress | Unreferenced. A Booth page |
| FR-015 | Expose events with cursor pagination | Unreferenced. A Booth page |
| FR-016 | Cancel a non-terminal Scene | The attempt cap and the ceiling bound a Scene; nobody has asked |
| FR-017 | Resume after a restart without repeating a charged model call | Crash-recovery guarantees deferred. A Scene is minutes and can be re-run |
| FR-018 | A wall-clock TTL terminating a Scene | The attempt cap and the ceiling are two bounds; a third is not needed for one recipe |
| FR-019 | Terminal states carry no further spend or activity | Unreferenced. A state-machine property |
| FR-020 | Exactly one worker may advance a Scene | Unreferenced. One instance, one worker |
| FR-021 | Idempotency on submission | No external trigger in v1; a person starts a Scene |

### Change, verification and delivery

| ID | Was | Gone because |
| --- | --- | --- |
| FR-031 | Never push to a default branch | Subsumed by [FR-010](03-requirements.md) and the envelope in [FR-123](03-requirements.md) |
| FR-036 | Workspace-wide patch policy: traversal, size cap, CI config, hooks, submodules | [FR-080](03-requirements.md)'s declared paths cover the single v1 recipe. **Returns the moment a recipe declares no path scope** |
| FR-037 | Syntax, format and lint before spending a model call | A cost optimisation, not a gate |
| FR-038 | Normalise verification output before computing a failure signature | The mechanism inside [FR-040](03-requirements.md), not a separate gate |
| FR-041 | Cycle detection across states | The attempt cap and progress oracle bound one recipe |
| FR-042 | The Reviewer's verdict is advisory and cannot mark success | No in-lane Reviewer. The Prompter is a different actor in a different lane |
| FR-043 | The full suite passes before delivery, not just a task-level pass | One Scene, one command — identical to [FR-033](03-requirements.md) here |
| FR-044 | Commit trailers naming Scene, model and prompt version | Authorship disclosure deferred. **Reopens before any client merges at volume** — a reviewer should not have to guess whether a human wrote a line |
| FR-045 | Report verified, failed verification or not verified | Subsumed by [FR-132](03-requirements.md), which states it plus the rest of the display rules |
| FR-085 | Enabling a recipe executes its oracle against the base branch | [FR-004](03-requirements.md) does this at connection |
| FR-105 | Re-plan a Scene whose base commit moved | The behaviour follows from [FR-035](03-requirements.md)'s rejection; [NFR-044](03-requirements.md) measures its cost. **A judgement call worth checking** |

### Models, cost and context

| ID | Was | Gone because |
| --- | --- | --- |
| FR-046 | Refuse to start if a capability tier is unconfigured | One instance, configured at provisioning |
| FR-047 | Route by capability tier; never name a model in calling code | The provider seam survives in [02-architecture.md](02-architecture.md); a gate is not needed for two prompts |
| FR-048 | A configured fallback endpoint per tier | Availability engineering deferred |
| FR-050 | Record tokens, cost, latency, provider and prompt version per call | [FR-063](03-requirements.md) requires the entry; the field list is [CON-04](04-contracts.md) |
| FR-051 | A budget refusal parks the Scene and never downgrades the model | Folded into [FR-049](03-requirements.md) |
| FR-052 | Validate agent output against its schema, one repair retry | [CON-02](04-contracts.md) and [CON-03](04-contracts.md) carry it |
| FR-053 | Versioned prompt templates recorded on every call | Prompt versioning deferred with the evaluation harness |
| FR-069 | The toolbelt constructed from the state's declared authority | The mechanism behind [FR-080](03-requirements.md); [CON-02](04-contracts.md) carries it |
| FR-070 | The named tool set, and no free-form shell tool | Deferred as a gate; [CON-02](04-contracts.md) declares the tools. **The no-shell rule still binds** |
| FR-071 | A ranked repository map rather than file contents by default | Context engineering deferred |
| FR-072 | Measure prompt tokens and refuse rather than truncate | Same |
| FR-073 | Truncate and normalise verification output in a prompt | Same |
| FR-074 | Attempt history as compacted records, never raw transcripts | Same |
| FR-075 | Tool results presented as delimited untrusted data | Injection hardening deferred as a gate; the authority model in [CON-02](04-contracts.md) is the real control |

### The Rehearsal Room

| ID | Was | Gone because |
| --- | --- | --- |
| FR-058 | Explicit CPU, memory, process and disk limits | Folded into [FR-054](03-requirements.md) |
| FR-059 | A reaper destroying orphaned rooms | Folded into [FR-054](03-requirements.md)'s idle timeout |
| FR-060 | Record the execution image digest on the Scene | Reproducible images deferred with FR-008 |
| FR-061 | Network access only at image build time | Superseded by [FR-057](03-requirements.md) ([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md)) |

### The Prompt Book and audit

| ID | Was | Gone because |
| --- | --- | --- |
| FR-064 | Folding the log reproduces state and spend exactly | Replay guarantees deferred. The fold is a debugging tool, not a v1 gate |
| FR-065 | Audit export as newline-delimited JSON | Export format deferred; the Booth shows the Prompt Book |
| FR-066 | Redact secret-shaped values before persistence | Deferred as a gate. **A judgement call worth checking:** no credential reaches a Scene ([FR-056](03-requirements.md)) and [NFR-005](03-requirements.md) scans the room, but nothing gates the control plane's own log lines |
| FR-067 | The viewer shows the timeline, per-step cost and artifacts | A Booth page ([CON-06](04-contracts.md)) |
| FR-068 | Every egress decision recorded as an event | Folded into [FR-057](03-requirements.md) |

### The judgement lane

| ID | Was | Gone because |
| --- | --- | --- |
| FR-086 | A judgement Scene never described in the verified vocabulary | Folded into [FR-132](03-requirements.md) |
| FR-087 | The lane visible before the content; verified rendered differently | Folded into [FR-132](03-requirements.md) |
| FR-089 | `demonstrated` and `unverified` rendered differently | Folded into [FR-132](03-requirements.md) |
| FR-090 | Comment counts by evidence state recorded per class | Folded into [FR-130](03-requirements.md)'s evidence rate |
| FR-091 | The Prompter writes only inside its evidence room | Carried by [FR-080](03-requirements.md) plus [FR-123](03-requirements.md) |
| FR-092 | No judgement output satisfies a verified gate | Folded into [FR-088](03-requirements.md) |
| FR-093 | Judgement Scenes bounded on the same terms as verified ones | The bounds are not lane-aware. FR-039, FR-040 and FR-049 apply to every Scene |
| FR-094 | No figure blended across lanes | Folded into [FR-130](03-requirements.md)'s per-lane requirement |
| FR-147 | Every recipe declares its lane, immutably | [CON-02](04-contracts.md) carries it as a contract property |
| FR-149 | A concern with no evidence emitted labelled, never suppressed | Folded into [FR-088](03-requirements.md) |
| **FR-084** | A review class runs read-only and never produces a patch | **Withdrawn, not deferred.** Incompatible with review by evidence: writing a failing test *is* producing a patch. Identifier retired ([ADR-0023](03-adr/0023-advisory-findings-carry-evidence.md)) |

### Shows as campaigns

All deferred with the capability. [FR-100](#capability) is different: it is **superseded** by
[ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md), not deferred.

| ID | Was | Gone because |
| --- | --- | --- |
| FR-095 | A Show declares a progress command yielding a remaining count | No campaign driver |
| FR-096 | Progress measured on the default branch; work in flight reported separately | No campaign driver. **The rule is the one most worth re-reading before rebuilding this** |
| FR-097 | Four declared Show ceilings, none raisable while active | No campaign driver |
| FR-098 | The campaign progress oracle | No campaign driver |
| FR-099 | A Show creates Scenes and never tasks | No campaign driver |
| FR-100 | Exclusive path claims per repository | **Superseded** by optimistic concurrency ([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)) |
| FR-101 | The Show event log and its fold | No campaign driver |
| FR-102 | Durable pause and resume, re-surveying before creating work | No campaign driver |
| FR-103 | Terminal Show states requiring a human decision to leave Held | No campaign driver |
| FR-104 | Versioned Show configuration recorded per Scene | No campaign driver |

### Front of House

All deferred with the capability ([ADR-0025](03-adr/0025-chat-front-door-request-broker.md)). Two are
worth reading before any chat integration is built: FR-107, because channel membership must never
confer authority, and FR-114, because it is what stops the channel becoming an exfiltration path.

| ID | Was |
| --- | --- |
| FR-106 | A chat message becomes a request, and a request is not a Scene |
| FR-107 | Requester identities mapped to entitlements by an administrator, never by channel membership |
| FR-108 | Broker onto an entitled recipe, or decline with a reason from a closed set |
| FR-109 | Clarification bounded by a declared question count and a TTL |
| FR-110 | Triage passes budget admission before spending |
| FR-111 | Ambiguity declined, never resolved by inference |
| FR-112 | An approval requires an authenticated principal and the digests they saw |
| FR-113 | A requester follows progress without a git-host account and gains no repository access |
| FR-114 | A per-field posting allowlist: never source, patch content, verification output or comment bodies |
| FR-150 | Never post into a channel or thread it was not addressed in |

### Residency and ingestion

All deferred ([ADR-0026](03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). FR-115 and
FR-121 are cut as **gates**, not as properties: the Crew and the Prompter are constructed per Scene and
hold nothing between Scenes, and nothing survives outside git, the Prompt Book and configuration.

| ID | Was |
| --- | --- |
| FR-115 | Agents constructed per state entry and discarded |
| FR-116 | Inbound triggers recorded before being acted on, idempotent on the delivery identifier |
| FR-117 | Visible, bounded queues carrying position, age, reason and cause |
| FR-118 | Durable schedules with recorded skips and no backfill |
| FR-119 | Admission at deployment, tenant, project and campaign level |
| FR-120 | No new long-running process kind |
| FR-121 | State surviving only in git, the event logs and versioned configuration |

### Repository access

| ID | Was | Gone because |
| --- | --- | --- |
| FR-124 | Registration enumerates required permissions and refuses if any is absent | [FR-004](03-requirements.md) refuses at connection; the missing-permission case is caught at run time by [FR-126](03-requirements.md) |
| FR-125 | A missing permission at run time parks the Scene with no fallback | Folded into [FR-126](03-requirements.md) |
| FR-127 | An administrator can disable a House or the whole instance | One instance per client; stopping it is an operator action, not a product surface |
| FR-128 | Every git operation recorded with operation, ref, identity and outcome | Folded into [FR-063](03-requirements.md), which requires an entry per effect |

### The Booth and reporting

| ID | Was | Gone because |
| --- | --- | --- |
| FR-129 | The full console page set | Four pages in v1 ([CON-06](04-contracts.md)) |
| FR-131 | Every effectiveness figure derived from the log by a published query | Folded into [FR-130](03-requirements.md) |
| FR-133 | Server-side rendering; no separate frontend build | An architecture rule ([02-architecture.md](02-architecture.md)), not a gate |
| FR-134 | Budgets and alert thresholds at four levels; administrative actions as events | Budget administration deferred with the Booth |
| FR-135 | An approval policy binding scope, lane and class to permitted principals | No team model in v1. **Reopens with the second person at a client who may approve** |
| FR-136 | An auditor role that can read and cannot start work | No role model in v1 |
| FR-137 | No console surface executes anything on demand | An architecture rule and a contract test ([CON-06](04-contracts.md)) |
| FR-138 | No cross-tenant aggregation without recorded consent | No tenants |
| FR-139 | Every measure carries the count it was computed from | Folded into [FR-130](03-requirements.md) and [FR-132](03-requirements.md) |

### Evaluation

All deferred with the harness. The argument for it survives: without a baseline, every prompt change
is anecdote and every cheaper model silently raises total cost by adding attempts.

| ID | Was |
| --- | --- |
| FR-076 | A golden-task harness reporting pass rate, cost, attempts and escalation |
| FR-077 | Results written as a machine-readable baseline artifact |
| FR-078 | Adversarial cases containing prompt-injection content in repository files |
| FR-079 | At least one unsatisfiable case asserting bounded termination |
| FR-148 | Judgement-lane cases asserting the recorded evidence state matches what was produced |
| FR-082 | Scheduled Scenes subject to the same bounds as human-started ones | Scheduling deferred |

## Non-functional requirements cut

32 of 42. Grouped.

| ID | Was | Gone because |
| --- | --- | --- |
| NFR-001 | Rehearsal Room create-to-ready latency budget | A latency budget for a room that a Scene waits minutes behind |
| NFR-003 | Zero host processes able to observe a room's filesystem | Folded into [FR-055](03-requirements.md)'s no-mounts rule |
| NFR-004 | A patch SLO for runtime and base-image CVEs | Operational commitment deferred; one instance, patched by us |
| NFR-006 | Verification runs with zero network interfaces | **Superseded** by [NFR-007](03-requirements.md)'s allowlist ([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md)) |
| NFR-008 | Redaction removes 100% of a seeded secret corpus from logs and artifacts | Deferred with [FR-066](#the-prompt-book-and-audit). **A judgement call worth checking** |
| NFR-011 | Wall-clock TTL and room destruction within a bound | Deferred with FR-018 |
| NFR-012 | An unsatisfiable request terminates having spent under a quarter of its ceiling | Deferred with the evaluation harness |
| NFR-013 | Cached input tokens above a floor on later attempts | Cost optimisation deferred |
| NFR-014 | Assembled prompts under a token ceiling; refuse rather than truncate | Context engineering deferred |
| NFR-016 | Folding the log reproduces state and spend for a replay corpus | Deferred with FR-064 |
| NFR-017 | Prompt Book append latency budget | No measured workload to budget against |
| NFR-019 | Crash recovery reaches a terminal state with zero duplicated charges | Deferred with FR-017 |
| NFR-020 | Bootstrap to a passing smoke test within 30 minutes and 15 commands | Self-hosted packaging deferred; we provision instances |
| NFR-021 | At most four long-running process kinds | Operability ceiling deferred as a gate. **The principle still holds and losing the gate is a real risk** |
| NFR-022 | At most eight alert rules | Same |
| NFR-023 | Control API latency budget | No client load to budget against |
| NFR-024 | Control plane and database memory budgets | Same |
| NFR-025 | A monthly automated restore drill | Backup verification deferred. **Reopens before the first client's data matters** |
| NFR-026 | Golden-task pass rate above a threshold before a design partner | Deferred with the harness; [NFR-043](03-requirements.md) measures the buyer's number instead |
| NFR-027 | A prompt or model change may not regress pass rate or cost beyond a margin | Deferred with the harness |
| NFR-028 | Zero adversarial cases producing a tool call outside declared authority | Same |
| NFR-029 | Zero cross-tenant reads | No tenants |
| NFR-030 | Evidence ratio per judgement class | Folded into [NFR-043](03-requirements.md) |
| NFR-031 | Judgement-lane acceptance rate | Folded into [NFR-043](03-requirements.md) |
| NFR-032 | No Show exceeds its declared ceilings | Deferred with campaigns |
| NFR-033 | Ingestion completeness and idempotency | Deferred with residency |
| NFR-034 | Zero queued items without a position, age and reason | Same |
| NFR-036 | Zero chat posts containing source or comment bodies | Deferred with Front of House. **Read it before building the chat adapter** |
| NFR-037 | Every console display rule asserted | Folded into [FR-132](03-requirements.md)'s `int` verification |
| NFR-038 | No request exceeds its triage allowance | Deferred with Front of House |
| NFR-039 | The acceptance-rate measure agrees with a hand-checked sample | Folded into [NFR-043](03-requirements.md), which carries the hand-check |
| NFR-040 | The Show progress-oracle cycle count, set by measurement | Deferred with campaigns |
| NFR-041 | Folding the Show and request logs reproduces their state | Deferred with campaigns and Front of House |
| NFR-042 | Verified-lane acceptance rate measured per class before a design partner | Folded into [NFR-043](03-requirements.md) |

## User stories cut

36 of 48, as titles. Twelve survive in [03-requirements.md](03-requirements.md).

**Install and operate:** US-001 install on my own host · US-021 cancel a Scene and clean up · US-022
restore from backup · US-045 install the same system you host.

**Free-text intake and generated planning** — these four return with [OQ-19](06-open-questions.md), and
they are the correct stories for it: US-004 submit a change request · US-005 see the plan before money
is spent on it · US-006 refuse a plan that cannot be checked · US-008 deployment artifacts, not just
application code.

**Audit and replay:** US-012 stop retrying when retrying cannot help *(its requirements survive as
FR-040)* · US-015 prove where the code could have gone · US-016 replay a Scene to understand a failure
· US-017 survive a restart mid-Scene.

**Operate and improve:** US-018 see what a Scene cost and where · US-019 change a prompt without
gambling · US-020 know that injected instructions cannot escalate.

**The judgement lane:** US-024 get comments on my own Preview *(the trigger is deferred with residency;
the capability survives)* · US-026 never be shown a guess formatted as a proof *(its rule survives in
FR-132)* · US-027 find out whether the review is actually helping.

**Campaigns:** US-028 declare a campaign and find out if it cannot be measured · US-029 see how much is
left, truthfully · US-030 stop a campaign achieving nothing · US-031 pause for a release and resume ·
US-032 two campaigns that do not corrupt each other.

**Front of House:** US-033 ask for a change in the channel I already use · US-034 be told honestly when
it cannot be done · US-035 follow it without a git account · US-036 prevent a channel guest from
spending our budget.

**Administration and reporting:** US-038 not be shown a confident number computed from nothing *(its
rule survives in FR-132)* · US-039 set a budget per team and per repository · US-040 say who may
approve what · US-044 keep one tenant's work away from another's *(removed with tenancy)*.

**Residency:** US-046 react to what happens in my repository · US-047 see why nothing is happening ·
US-048 not be surprised by a missed schedule.

**Retired by scope rather than deferred:** US-023 have maintenance done while nobody watches
*(scheduling)* · US-043 be told which permission is missing *(folded into FR-126)*. US-042 survives
in [03-requirements.md](03-requirements.md).

## Documents retired

The specification went from 79 documents to eight. Where each went:

| Was | Now |
| --- | --- |
| `00-context/01-problem-and-vision.md` | [01-product.md](01-product.md) |
| `00-context/03-glossary.md` | [01-product.md](01-product.md), as the Scenio vocabulary |
| `00-context/02-ecosystem-and-stakeholders.md` | Retired. The intake's competitive table and unverified claims carried no decision weight |
| `00-context/04-business-model.md` | Retired. The pricing structure survives as an unanswered prerequisite above |
| `00-context/05-evidence-and-confidence.md` | Retired. Its discipline survives in the [README](../README.md)'s closing section |
| `00-context/06-vision-change-2026-09.md` | Retired. [ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md) and this document carry it |
| `01-product/01`–`10` | [01-product.md](01-product.md), [03-requirements.md](03-requirements.md), this document |
| `02-architecture/01`–`19` | [02-architecture.md](02-architecture.md) |
| `04-engineering/01`–`06` | Retired. Repository structure, coding standards, testing strategy, git workflow and CI belong with running code, and there is none |
| `05-delivery/01`–`04` | [05-roadmap.md](05-roadmap.md) and this document |
| `contracts/README.md` | [04-contracts.md](04-contracts.md) |
| All ADRs | **Kept.** Decision history is cheap and losing it is expensive ([03-adr/README.md](03-adr/README.md)) |

**What the cut cost, stated once.** The retired documents carried arguments the eight cannot hold at
the same length: the named adversaries in the threat model, the per-dependency degraded-mode tables,
the query rules, the persona-to-surface matrix, the ranked register of unproven claims, and the
reading paths. The ADRs retain the decisions. They do not retain all of the reasoning that surrounded
them, and some of it will have to be re-derived
([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md), negative consequences).
