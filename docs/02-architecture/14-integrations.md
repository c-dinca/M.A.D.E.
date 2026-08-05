# Integrations

Three external dependencies, deliberately. Each is listed with its interface, its degraded mode, its
limits and where its data goes. The degraded mode is not optional documentation: the honest-failure
principle ([01-system-overview.md](01-system-overview.md#design-principles-as-tie-breakers)) requires
that every dependency has a specified behaviour when it is unavailable, and a dependency whose
degradation is undefined will eventually degrade into a silent wrong answer.

## Git host

**Interface.** Standard git over HTTPS or SSH for fetch and push, plus the host's REST API for opening
a pull request. v1 targets GitHub and GitLab; both are reached through one internal `GitHost` port with
two adapters, so a third is additive.

**Data.** Repository content flows both ways. Credentials are C1 and live in the host secret store,
never in a Sandbox ([13-security-and-compliance.md](13-security-and-compliance.md)).

**Access pattern.** The control plane maintains a bare mirror per Project and populates Sandboxes from
it by file transfer ([04-execution-isolation.md](04-execution-isolation.md)). A Sandbox never runs
`git fetch` or `git push`, because either would require network and a credential.

**Least privilege.** The credential needs read on the repository, write on non-default branches, and
pull-request creation. It must not have force-push, branch deletion, settings, or organisation scope.
Where the host supports finer grants, use them; where it does not, say so to the customer rather than
implying a restriction that is not enforced.

**Degraded mode.** Fetch failure at Run start: reject the Run with `503` and a message naming the host.
Push or pull-request failure at delivery: park in `AWAIT_HUMAN(delivery_failed)` with the branch
retained locally and re-deliverable. The Run is **never** reported as delivered when the push failed —
that is exactly the class of comfortable lie the product exists to avoid.

**Rate limits.** Both hosts rate-limit their APIs. v1's call volume is a handful per Run, far below any
published limit, so no client-side limiter exists. On a `429`, retry with backoff within the effect
budget, then park.

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

**Limits.** Concurrent Sandboxes are bounded by host capacity and the configured concurrency cap;
exceeding it returns `429` rather than queueing ([03-api-design.md](03-api-design.md)).

## Deliberately not integrated

Each of these is a plausible request. The reason for refusing is what an agent needs, because the
request will recur.

**Issue trackers (Jira, Linear, GitHub Issues) as a Run trigger.** An external system creating Runs
means an external system spending budget, and it moves the approval decision away from a person who
saw the plan. The correct integration is the customer calling our API from their own automation, which
keeps authorisation on their side. Revisit when a design partner asks for it with a specific
authorisation model.

**Chat platforms (Slack, Teams) for approvals.** An approval is a security decision that must be
attributable to an actor and bound to the artifact digests they saw
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)). A chat button is easy to
click, easy to spoof relative to an API key, and hard to bind to what was displayed.

**Outbound webhooks.** A new egress path from the control plane to a customer-configured URL, defended
for the convenience of not polling. The event log with a sequence cursor is already a better
notification primitive ([03-api-design.md](03-api-design.md)).

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
| Git host | Reject at start; park at delivery, branch retained | Retry with backoff, then park | Push rejected → park; never report delivered |
| Model endpoint | Fallback, then park with `provider_unavailable` | Tier timeout; availability failure, not a Task failure | Schema validation fails → one repair, then the State fails |
| Sandbox runtime | Refuse to execute; no fallback | Creation timeout → treat as unavailable | Preflight identity check fails → refuse |
| Postgres | All execution stops; API returns 503 | Append latency alert | Transaction failure → effect not performed |
| Object store | Fail the State, retry, then park | Retry with backoff | Digest mismatch on read → treat the artifact as missing and fail loudly |
