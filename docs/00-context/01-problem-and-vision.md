# Problem and vision

> **Revised by the 2026-09 vision change.** The previous framing of this document targeted regulated
> enterprises whose security function would not let source code leave the perimeter, and it is
> preserved and marked in [06-vision-change-2026-09.md](06-vision-change-2026-09.md) rather than
> deleted. The new framing is broader. Whether the security-perimeter argument remains the primary
> selling point, becomes a secondary one, or is dropped is **OQ-15**, and nothing below depends on the
> answer.

## The gap

An engineering organisation has a category of work that is never the most important thing to do today
and is always overdue: dependency upgrades, framework migrations, lint and type debt, TODOs that
outlived their author, review of other people's pull requests, and the small fixes that a
non-developer notices and nobody schedules. It is contractually required, low-margin, hard to staff
and universally disliked, and scaling it by hiring stopped being sustainable.

The available tooling splits the work and leaves the expensive half in each case.

**Dependabot and Renovate** open the pull request; when the upgrade breaks the build they leave a red
one for a senior engineer. **Claude Code and Cursor** do that fix well, and are interactive by design:
they assume a human at a keyboard approving steps and noticing when a run goes wrong. Nobody watches a
package bump across two hundred repositories. **Review tools** post comments a reader has to
re-derive, at a volume a machine can produce faster than a human can evaluate. **Migration campaigns**
are handled by a spreadsheet, a rota and somebody's memory, and they stall the moment their champion
moves team. And the person who actually notices a defect is frequently not the person with commit
access, so the request dies in a chat thread.

Per the assessment carried in the project intake, the autonomous cloud agents that promise to close
these gaps push a wrong solution forward instead of stopping to ask, are billed per unit of autonomous
compute so that a reasoning error becomes a bill, and are opaque about what they executed. That
assessment is recorded as unverified
([02-ecosystem-and-stakeholders.md](02-ecosystem-and-stakeholders.md#claims-carried-from-the-intake-unverified))
and no decision here depends on it being true.

## What M.A.D.E. is

**An environment in which a swarm of role-specialised agents lives inside a company's development
infrastructure and continuously takes over the work that consumes developer time.**

*Lives inside* is a claim about the company's infrastructure — the repositories, the container
runtime, the hosts they already run — and about behaviour: the system acts without being asked,
because a pull request was opened, a schedule fired, a campaign has slices left, or somebody asked for
something in a chat channel. It is deliberately **not** a claim about long-lived agent processes
holding context. Agents are constructed per State entry, receive artifacts, produce an artifact and
are discarded; residency is a property of the control plane's durable ingestion, schedules and queues
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)). Anything an agent
concluded reaches later work only as a named artifact with a digest, because a Run that cannot be
explained from its own record is a Run that cannot be sold to the person who has to approve it.

It runs as **one artifact in two shapes**: a service we host for many tenants, and an installation a
customer operates themselves. Which one v1 targets first is **OQ-01**; that both are supported is
decided ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)).

### The distinction the product rests on

The work divides into two categories with fundamentally different properties, and conflating them is
the single most damaging thing this system could do
([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md),
[01-product/06-lanes.md](../01-product/06-lanes.md)).

**The verified lane.** A command declared in advance decides the outcome: dependency upgrades,
migrations, code fixes, test generation, codemods. The exit code is the arbiter. Every mechanism
described in this repository — the task graph, the sandboxed execution, the guards, the event log —
was designed for exactly this and is unchanged.

**The advisory lane.** No such command exists: reviewing a human's pull request, finding bugs, triaging
TODO debt, turning a non-developer's chat message into a correct change request. **There is no exit code
for "is this review good".** So the trust model is different: the agent proposes, a human decides, and
quality is measured statistically over time rather than proven per Run.

Advisory output carries no correctness guarantee, and the interface says so in those words. That is a
product feature. The verified lane's guarantee is only worth something if it is scoped honestly, and a
suggestion rendered in the typography of a proof destroys both.

**Review by evidence** is what keeps the advisory lane from being another comment generator. Wherever
it is possible, an advisory agent produces an artifact rather than an opinion: the failing test that
demonstrates the bug, the benchmark that shows the regression, the reproduction case. A reader checks
evidence in seconds; an opinion has to be re-derived. When the agent cannot produce evidence it says
so and the finding is marked *unverified* — never dressed in the same formatting as a demonstrated one
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)).

### Three properties that define it

**Execution is isolated by an enforced boundary, not by policy.** Model-generated code runs under a
kernel that is not the host kernel, with no credentials and no network during verification. The claim
is carried by an escape test suite that gates every deploy, not by an assurance in a sales deck.
Multi-tenant hosting raises this requirement rather than lowering it, and the boundary adequate for it
is **OQ-10**. See [02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md).

**Termination and cost are system properties, not hopes.** Agents produce typed artifacts; deterministic
code decides what happens next. Attempt caps, a progress oracle, cycle detection and pre-flight budget
admission make an unbounded Run structurally impossible. Worksites add the same discipline one level
up: a declared spend ceiling, a Run ceiling, a duration ceiling, a cap on concurrently open pull
requests, and a campaign-level progress oracle that pauses a worksite that is not reducing its own
remaining count. See
[02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md)
and [01-product/07-worksites.md](../01-product/07-worksites.md).

**Success in the verified lane is defined by an exit code.** No work enters the verified lane without a
machine-checkable command, and no model opinion can override the result of running it. See
[02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md).

### What is delivered

A branch and a pull request, on the customer's repository, opened by the system's own scoped identity —
never by a human's access token — with a permission envelope that can be printed and tested and revoked
in one action ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). Alongside it:
the tests that prove the change, the attempt trail, the cost, and an audit record of every command
executed and every token spent. For the advisory lane, findings with their evidence. For a worksite, a
remaining count measured on merged state.

A human merges. Always.

## Why now

Four conditions hold simultaneously.

Coding models are strong enough to do the high-volume iterative work, and cheap enough that the
volume is affordable — which matters because the value per job here is small and volume has to carry
the model ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)).
Kernel-level sandboxing is packaged well enough that a single engineer can deploy it, which is what
makes the isolation claim affordable. The failure modes of the first generation of autonomous agents
are documented in the open, so a buyer understands what they are protecting against. And every
company already runs the surfaces this system needs to live in: a git host, a chat platform, a
container runtime.

## What winning looks like

Winning is narrow and measurable, and it is measured in the buyer's terms rather than ours.

**A company can point at a number.** The share of pull requests the system opened that merged with no
human editing the diff; the cost per merged pull request; how often a human had to intervene; how long
a request took to reach a merge. Those figures are on the effectiveness dashboard, computed from the
event log by queries the customer can run themselves
([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). No competitor in this category
reports them honestly, and a company renewing this product is answering exactly that question.

**A migration finishes.** A worksite declared against a real repository reduces its measured remaining
count to zero, across weeks, surviving restarts and upgrades, without a human tracking it in a
spreadsheet.

**A non-developer gets a merged change** they asked for in a sentence, in a channel, without a
git-host account — or an honest decline with a reason, in the same thread.

The counterfactual matters more than the demo. A Run that stops and says "I could not make the test
pass; here are the three attempts and what each failed on, at a cost of $0.14" is a success of this
system. A Run that produces a plausible diff and claims it works is a failure even if the diff happens
to be correct, because it destroys the property everything else is built on. The advisory equivalent:
a finding marked *unverified* is a success; a guess formatted as a proof is not.

## Non-goals

Excluded by strategy, not by schedule. An agent that "helpfully" adds one is doing damage.
Anything postponed rather than excluded is in
[01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md), with its reason.

- **Not a prototyping toy.** Generating a fresh application from a sentence is out of scope
  ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md) closed this, and
  [ADR-0019](../03-adr/0019-specification-first-projects.md) is withdrawn). The verified lane needs a
  test harness the system did not write; for a new project there is none.
- **Not a model.** No training, no fine-tuning. Models are pluggable inputs
  ([ADR-0012](../03-adr/0012-model-tiers-and-provider-abstraction.md)).
- **Not an IDE.** No editor, no autocomplete, no inline suggestions. That market is served.
- **Not autonomous merge.** The system opens a pull request; a human merges. It cannot push to a
  default branch, cannot merge, cannot enable auto-merge, and cannot submit an approving review
  ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md),
  [FR-031](../01-product/03-functional-requirements.md),
  [FR-032](../01-product/03-functional-requirements.md)).
- **Not work without a runnable check.** "Improve quality", "modernise this module", "make it faster"
  are judgement calls dressed as tasks. In the verified lane they are refused. In the advisory lane
  they are refused as *tasks* and permitted only as findings that carry evidence or say they do not
  ([01-product/06-lanes.md](../01-product/06-lanes.md)).
- **Not an unbounded conversation.** The chat front door is a request broker with a bounded
  clarification allowance, not a chat product. It triages, asks at most a declared number of
  questions, and then either invokes a work class the requester is entitled to or declines with a
  reason ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)).

> **A non-goal that was reversed.** The previous version of this document listed "**not a chat
> product** — there is no free-form conversation surface with an agent. Every interaction is a typed
> request, an artifact, or an approval decision." The chat front door reverses the first half of that.
> What survives, and is now the tighter rule above, is the second half: an *approval* is still a typed,
> attributable decision bound to the artifact digests the approver saw, and it does not happen in a
> chat client (OQ-20).

## The ethical position, stated as engineering constraints

Product commitments with tests behind them, not values statements.

**The system does not claim success it cannot prove.** Any output presented as verified is backed by a
recorded command, its exit code and its normalised output. Where verification did not run or did not
pass, the surface says so in those words. Advisory output is never presented as verified, a finding
without evidence is labelled *unverified*, and the two are never rendered alike. Enforced by
[02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md),
[NFR-010](../01-product/04-non-functional-requirements.md) and
[ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md).

**The system does not claim to be worth paying for without proof either.** The effectiveness dashboard
reports acceptance rate, cost per merged pull request, intervention rate and time to merge from the
audit log, per lane and per class, with the count each figure was computed from — and renders
"insufficient data" rather than a flattering percentage over three samples
([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)). Enforcing truthfulness about Tasks
while advertising activity metrics about ourselves would be an inconsistency in our own favour.

**Progress is measured on merged state.** A worksite's completion moves when a human merges something.
Delivered but unmerged pull requests are reported as work in flight and never as progress
([ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)).

**The customer's source goes only where the customer configured it to go.** Egress destinations are an
explicit allowlist and every decision is recorded. Chat platforms are third parties: what may be posted
to one is an allowlist of status, links and counts, never source, patch content or verification output
([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)). Enforced by
[02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md) and
[NFR-007](../01-product/04-non-functional-requirements.md).

**Access is least-privilege, printable and revocable.** The system authenticates as its own
installation with a permission envelope that is enforced where requests are constructed and asserted by
tests, and a customer revokes it in one action without our cooperation
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

**Authorship is disclosed.** Every commit carries trailers naming the run, the task, the model and the
prompt version. A reviewer must never have to guess whether a human or a machine wrote a line.

**Cost is visible before it is spent.** Every Run declares a ceiling and refuses to exceed it; so does
every worksite. A user is never surprised by a bill produced by a loop they did not authorise — and a
schedule or a campaign is exactly the loop nobody authorised item by item.
