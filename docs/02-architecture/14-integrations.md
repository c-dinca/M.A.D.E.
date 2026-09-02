# Integrations

**Four** external dependencies now. Each is listed with its interface, its degraded mode, its limits
and where its data goes. The degraded mode is not optional documentation: the honest-failure principle
([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)) requires that every
dependency has a specified behaviour when it is unavailable, and a dependency whose degradation is
undefined will eventually degrade into a silent wrong answer.

> **This document previously refused most of what the 2026-09 vision change requires**, and the
> refusals were argued rather than assumed. Chat platforms were refused for approvals, issue trackers
> were refused as a Run trigger, and outbound webhooks were refused as a new egress surface. **Those
> reasons have not become wrong; they have been overruled by a product requirement**
> ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). The original arguments are retained
> below with what changed, because the mitigations that follow are mitigations rather than answers.

## Git host

**Interface.** Standard git over HTTPS or SSH for fetch and push, plus the host's REST API for opening
a pull request and posting review comments — **and now inbound events** for pull requests opened or
updated, pushes to a default branch, and completed check suites
([FR-116](../01-product/03-functional-requirements.md)). v1 targets GitHub and GitLab; both are reached
through one internal `GitHost` port with two adapters, so a third is additive.

**Data.** Repository content flows both ways. Finding bodies flow to the host, because the code they
describe is already there ([13-security-and-compliance.md](13-security-and-compliance.md)). Credentials
are C1, live in the host secret store per tenant, and never enter a Sandbox.

**Access pattern.** The control plane maintains a bare mirror per Project and populates Sandboxes from
it by file transfer ([04-execution-isolation.md](04-execution-isolation.md)). A Sandbox never runs
`git fetch` or `git push`, because either would require network and a credential.

**Least privilege.** The credential is the system's **own** application installation per tenant, never
a human's personal access token, and the permission envelope is a hard boundary enforced where requests
are constructed ([19-repository-access.md](19-repository-access.md),
[ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). The previous guidance —
"where the host supports finer grants use them; where it does not, say so to the customer rather than
implying a restriction that is not enforced" — is retained verbatim as a rule and given a table in
[19-repository-access.md](19-repository-access.md#per-host-reality) separating what we enforce from what
the host enforces.

**Inbound events.** Endpoints authenticate and verify the delivery signature, record an `ingress_event`,
and return. **They do no work on the request path** — anything that executed there would be an
unbounded surface driven by somebody else's activity. Delivery is idempotent on the provider's delivery
identifier, so a redelivery storm produces no second Run
([NFR-033](../01-product/04-non-functional-requirements.md)). A deployment that cannot accept inbound
connections **polls instead**, producing the same ingress rows with the same key, and the latency
consequence is stated rather than hidden
([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)).

**Degraded mode.** Fetch failure at Run start: reject the Run with `503` and a message naming the host.
Push or pull-request failure at delivery: park in `AWAIT_HUMAN(delivery_failed)` with the branch
retained locally and re-deliverable. The Run is **never** reported as delivered when the push failed —
that is exactly the class of comfortable lie the product exists to avoid. Inbound events stopping is
**not** a degraded mode with a fallback; it is an alert, because nothing fails visibly
([12-observability-and-slos.md](12-observability-and-slos.md), alert 5).

**Authorisation failures are not availability failures.** A missing or revoked permission parks the Run
with `access_insufficient` or `access_revoked` and is **never retried**
([FR-125](../01-product/03-functional-requirements.md),
[FR-126](../01-product/03-functional-requirements.md)). Distinguishing the two by status class is the
whole of the logic, and getting it wrong turns a boundary into a retry loop.

**Rate limits.** Both hosts rate-limit their APIs. Call volume was a handful per Run and is now higher
— a worksite cycle reads and writes across many repositories — but still far below published limits at
the concurrency caps in force. On a `429`, retry with backoff within the effect budget, then park.

**Residency.** For a cloud-hosted git provider, repository content is already in that provider's
control before we touch it, so we introduce no new residency question. For a self-hosted git server the
data never leaves the customer's network.

## Model endpoints

**Interface.** OpenAI-compatible chat completions with structured output, which covers hosted vendors
and local servers through one adapter
([10-llm-integration-and-evaluation.md](10-llm-integration-and-evaluation.md)).

**Data.** This is the only path by which C2 customer source leaves the host, and only to endpoints the
operator configured. In a local-only configuration nothing leaves.

**Degraded mode.** Primary error → bounded retry → configured fallback for that tier, recorded on the
call. Both unavailable → park in `AWAIT_HUMAN(provider_unavailable)`. Never substitute another tier's
model: the result would be attributed to a model that did not produce it, which corrupts both the audit
record and the evaluation baseline.

**Rate limits and cost.** Hosted providers limit requests and tokens per minute; a `429` is an
availability failure handled as above, not a Task failure, so it does not consume an Attempt. Cost is
the dominant variable term and is metered per call ([07-cost-control.md](07-cost-control.md)).

**Residency.** Determined entirely by the endpoint the operator configures. The system does not choose
a region, does not have a default endpoint, and refuses to start unconfigured
([FR-046](../01-product/03-functional-requirements.md)) precisely so that this is always a deliberate
choice.

## Sandbox runtime

**Interface.** The host's OCI runtime, invoked through `SandboxProvider` with the isolation runtime
selected explicitly.

**Data.** Workspace content (C2) inside the Sandbox for the Run's lifetime; nothing persists after
destroy.

**Degraded mode.** Unavailable, wrong version, or failing its preflight check → the system refuses to
execute ([FR-055](../01-product/03-functional-requirements.md)). There is **no** fallback to a weaker
runtime. This is the one dependency whose degraded mode is a hard stop, because degrading it silently
would falsify the product's central claim while every other test continued to pass.

**Limits.** Concurrent Sandboxes are bounded by host capacity and the concurrency caps at four levels
([FR-119](../01-product/03-functional-requirements.md)); a human request that cannot be admitted returns
`429`, and internally generated work queues visibly
([03-api-design.md](03-api-design.md#rate-and-concurrency-limits)).

## Chat platform

The fourth dependency, added by [ADR-0025](../03-adr/0025-chat-front-door-request-broker.md).

**Interface.** One adapter per supported platform behind an internal `ChatPlatform` port: inbound
messages addressed to the system in a thread, and outbound posts into that same thread. **Which
platform is supported first is OQ-22** — Slack, Microsoft Teams and Discord differ in permission model,
in whether inbound connectivity is required, and in how much of an organisation's access control lives
in channel membership. Three adapters maintained by one person is not affordable.

**Data.** Inbound: free text from an untrusted, **interactive** author — adversary A6
([13-security-and-compliance.md](13-security-and-compliance.md)). Outbound: a per-field allowlist of
request state, the work class and parameters, the outcome and decline reason, cost against the
requester's allowance, pull-request URLs, and finding **counts**
([FR-114](../01-product/03-functional-requirements.md)). **No source, patch content, verification
output, repository path, file name or finding body**, asserted against a seeded corpus
([NFR-036](../01-product/04-non-functional-requirements.md)).

**Authority.** None, ever. A chat identity is mapped to an entitlement by an administrator, and channel
membership confers nothing ([FR-107](../01-product/03-functional-requirements.md)). Approvals do not
happen here (OQ-20).

**Access pattern.** Inbound endpoints authenticate, verify the platform's signature, record an
`ingress_event`, and return. Outbound posts are worker-side effects, each recorded as an
`egress_decision` and a `chat_posted` event, and each disableable per deployment.

**Degraded mode.** Post failure: bounded retry, then record the egress decision as failed. Runs and
requests are unaffected — **but a request is never reported as answered when the post failed.** Same
rule as delivery, and for the same reason: a comfortable lie about whether a person was told is
indistinguishable from a comfortable lie about whether code was pushed. Inbound unavailable: no
requests arrive, which is visible in the ingress metric per source rather than as an error.

**Rate limits.** Every platform limits posting. The system posts only into threads it was addressed in
and never announces proactively ([FR-150](../01-product/03-functional-requirements.md)), which bounds
volume by request count rather than by activity; on a limit response, retry with backoff, then record
the failure.

## Deliberately not integrated

Each of these is a plausible request. The reason for refusing is what an agent needs, because the
request will recur.

**Issue trackers (Jira, Linear, GitHub Issues) as a Run trigger.** An external system creating Runs
means an external system spending budget, and it moves the approval decision away from a person who
saw the plan. The correct integration is the customer calling our API from their own automation, which
keeps authorisation on their side.

> **Note the tension with the chat front door, which is real.** A chat message *is* an external system
> creating work. What makes it acceptable, and what an issue tracker integration would also have to
> supply, is the entitlement mapping: a request can only invoke a class the requester was
> administratively granted, within a declared budget, with the approval gate still on our side
> ([01-product/08-chat-front-door.md](../01-product/08-chat-front-door.md)). An issue tracker
> integration becomes admissible on exactly those terms — an authorisation model, not just a webhook —
> which is what the original refusal asked for.

**Chat platforms for approvals.** An approval is a security decision that must be attributable to an
actor and bound to the artifact digests they saw
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)). A chat button is easy to
click, easy to spoof relative to an API key, and hard to bind to what was displayed. **This refusal
stands** — the front door posts a link and the decision is taken in the console or the API
([FR-112](../01-product/03-functional-requirements.md)) — and it is recorded as **OQ-20** rather than
closed, because a signed, digest-bound chat interaction is conceivable and is simply not designed.

**Outbound webhooks to arbitrary customer-configured URLs.** A new egress path defended generically for
the convenience of not polling. The event log with a sequence cursor is already a better notification
primitive ([03-api-design.md](03-api-design.md)).

> **Chat egress is not an exception to this.** The distinction is what makes the refusal survivable: a
> webhook is a URL the customer supplies and whose payload we must defend generically; a chat adapter
> is a named integration whose payload shape we control and can assert against a seeded corpus
> ([NFR-036](../01-product/04-non-functional-requirements.md)). If chat egress ever grows a "post
> anything to any URL" affordance, this refusal has been broken rather than qualified.

**Error-tracking and telemetry services (Sentry, analytics).** These would send C2-adjacent data —
stack traces containing repository paths and code fragments — to a third party by default. That
directly contradicts the air-gapped promise and would be discovered by the first security review.

**Container registries as a Run-time dependency.** Sandbox images are pulled by the operator ahead of
time and pinned by digest. A registry pull during a Run would add a network dependency to the hot path
and a supply-chain surface to the sandbox lifecycle.

**Secret managers as a hard dependency.** The default install reads secrets from an environment file
with restricted permissions. An external manager is supported by configuration where the customer has
one, but requiring it would block installation for customers who do not.

**Cloud provider APIs.** The DevOps agent writes deployment artifacts; it does not apply them. Granting
the system credentials to a customer's cloud account is a different product with a different threat
model, and it is explicitly out of scope ([15-future-phase-seams.md](15-future-phase-seams.md)).

## Dependency degradation summary

| Dependency | Unavailable | Slow | Wrong answer |
| --- | --- | --- | --- |
| Git host — outbound | Reject at start; park at delivery, branch retained | Retry with backoff, then park | Push rejected → park; never report delivered |
| Git host — **authorisation** | **Park with `access_revoked` or `access_insufficient`; never retry, never fall back** | n/a — authority is not slow | A widened grant does not widen behaviour; the envelope is enforced where requests are constructed |
| Git host — **inbound events** | No triggers arrive. **Alerted, not degraded**: nothing fails visibly ([12-observability-and-slos.md](12-observability-and-slos.md)) | Latency shows in ingress-to-work p95 | Redelivery → rejected by the idempotency key at insert |
| **Chat platform** | Inbound: no requests arrive, visible per-source. Outbound: bounded retry, then record the egress decision as failed | Retry with backoff | **A request is never reported as answered when the post failed** |
| Model endpoint | Fallback, then park with `provider_unavailable` | Tier timeout; availability failure, not a Task failure | Schema validation fails → one repair, then the State fails |
| Sandbox runtime | Refuse to execute; no fallback | Creation timeout → treat as unavailable | Preflight identity check fails → refuse |
| Postgres | All execution stops; API returns 503; **ingress endpoints reject rather than accept-and-lose** | Append latency alert | Transaction failure → effect not performed |
| Object store | Fail the State, retry, then park | Retry with backoff | Digest mismatch on read → treat the artifact as missing and fail loudly |

Two rows are worth reading together, because they are the same rule in two places. A **push failure**
must never be reported as delivery, and a **chat post failure** must never be reported as having told
somebody. Both are cases where the cheapest available behaviour is a comfortable lie about whether the
outside world received something, and both are the class of failure this product exists to eliminate.
