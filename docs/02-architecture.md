# Architecture

Read [01-product.md](01-product.md) first for the vocabulary. Every theatre term below carries its
plain description on first use, and the full table is there.

## What must never happen

Five failures shape everything here. They are not risks to be managed; each one ends the product.

**UF-1 — model-generated code escapes the Rehearsal Room** — the isolated execution environment — and
reaches the host. *Prevented by:* a container with no host paths mounted in, no credentials,
deny-by-default egress, explicit resource limits, and a refusal to execute at all if the runtime is
unavailable ([FR-054](03-requirements.md) to [FR-057](03-requirements.md),
[NFR-002](03-requirements.md)).

**UF-2 — a Scene consumes unbounded money or time.** *Prevented by:* admission control before every
model call, an attempt cap, and a progress oracle that refuses a retry which learned nothing
([FR-039](03-requirements.md), [FR-040](03-requirements.md), [FR-049](03-requirements.md),
[NFR-009](03-requirements.md), [NFR-010](03-requirements.md)).

**UF-3 — Scenio reports success it cannot prove.** *Prevented by:* a command declared before the work
starts, executed unmodified, whose exit code is the only thing that decides; no agent output able to
alter it; and a reporting vocabulary that distinguishes verified from failed from not-run
([FR-033](03-requirements.md), [FR-034](03-requirements.md), [FR-132](03-requirements.md),
[NFR-018](03-requirements.md)). In the judgement lane, where no such command exists, the equivalent is
the evidence state ([FR-088](03-requirements.md)).

**UF-4 — source or a secret leaves the perimeter the client authorised.** *Prevented by:* no
credentials in the Rehearsal Room, egress denied by default with every decision recorded, and a
repository permission envelope enforced where requests are constructed
([FR-056](03-requirements.md), [FR-057](03-requirements.md), [FR-123](03-requirements.md),
[NFR-005](03-requirements.md), [NFR-007](03-requirements.md), [NFR-035](03-requirements.md)).

**UF-5 — a Scene cannot be explained afterwards.** *Prevented by:* the Prompt Book — the append-only
audit log — carrying every execution and every model call, written in the same transaction as the
effect it records ([FR-062](03-requirements.md), [FR-063](03-requirements.md),
[NFR-015](03-requirements.md)).

## The loop

One Scene — one task within a Show — is the unit of execution and of delivery. One Scene produces one
Preview: one pull request.

```
                 recipe + House
                       │
                       ▼
   ┌──────────── Stage Manager (code, no model) ────────────┐
   │                                                        │
   │  1  instantiate the Scene from the declared recipe     │  FR-081
   │     zero model calls: the plan is not generated        │
   │                                                        │
   │  2  create the Rehearsal Room                          │  FR-054, FR-055
   │     container, no mounts, no credentials, egress deny  │  FR-056, FR-057
   │                                                        │
   │  3  Crew produces a patch                              │  FR-080
   │     writes only inside the Scene's declared paths      │
   │     exact-match blocks, never a fuzzy apply            │  FR-035
   │                                                        │
   │  4  Dress Rehearsal: run the declared command          │  FR-033, FR-034
   │     the exit code decides. No model in this step        │
   │                                                        │
   │     ├─ non-zero → attempt again, if anything was       │  FR-039, FR-040
   │     │             learned and the budget allows        │  FR-049
   │     │             otherwise → Held                     │
   │     └─ zero → continue                                 │
   │                                                        │
   │  5  The Call: a person approves                        │  FR-032
   │     nothing is pushed before this                      │
   │                                                        │
   │  6  Preview opened on the House                        │  FR-010, FR-123
   │     never the default branch, never a merge            │
   │                                                        │
   └────── every step writes its Prompt Book entry ─────────┘  FR-062, FR-063
                       │
                       ▼
              Opening Night — a human merges
```

**Held** is a Scene stopped and waiting for a person. **Dropped Cue** is a Scene that failed. Neither
is a spinner and neither is reported as progress ([FR-132](03-requirements.md)).

### The judgement loop

Shorter, because there is nothing to verify. The **Prompter** reads a human's Preview, and for each
concern attempts an executable demonstration in its own Rehearsal Room — the test that fails on the
branch and passes on its base, a reproduction, a benchmark. Each attempt is recorded.

Every comment then carries an evidence state, and there are exactly two
([FR-088](03-requirements.md)):

- **`demonstrated`** — an evidence record supports it: the argv vector, the tree it ran against, the
  exit code, the output. Produced by the same executor and the same output normaliser as the verified
  lane. There is no second implementation.
- **`unverified`** — no such record exists, and the comment says so in that word.

Three rules follow, and each closes a way this could be gamed:

**An evidence record is not a verification result.** Distinct event kind, distinct storage. It cannot
mark a Scene verified, and no query can confuse the two. *Demonstrated* is a claim about a command;
*verified* is a claim about a Scene.

**The Prompter never writes to reviewed code.** Its writes are confined to its own room by the
authority the state grants it, not by an instruction in a prompt
([FR-080](03-requirements.md)), and the permission envelope makes a push to the reviewed branch
unconstructible ([FR-123](03-requirements.md)).

**A demonstrated comment can still be wrong.** A test that fails may be testing behaviour the
maintainer deliberately does not support. Evidence raises checkability and does nothing for relevance
([ADR-0023](03-adr/0023-advisory-findings-carry-evidence.md)). That is why it leads with its command
and exit code: the reader sees what was actually established.

## The actors

Three actors. **Two are roles** ([ADR-0032](03-adr/0032-three-actors-two-roles.md)).

| Actor | Role? | Does | Must never |
| --- | --- | --- | --- |
| **Stage Manager** — the orchestrator | **No. It is code** | Instantiates Scenes, applies patches, executes the declared command, records every event, decides every transition | Hold a prompt or call a model |
| **Crew** — the agent that makes the change | Yes | Produces a patch from the recipe, the repository map and the attempt history | Modify the declared command, decide whether it succeeded, or write outside the Scene's declared paths |
| **Prompter** — the agent that reviews | Yes | Comments on a human's Preview, through evidence only | Write to reviewed code, ever |

**The Stage Manager's lack of judgement is a feature, not an omission.** Verification has no model in
the loop, which is what makes the exit code mean something. An orchestrator with a prompt could be
persuaded; code cannot.

Director, Scenarist and Répétiteur do not exist. A dependency upgrade does not need an architecture
agent when the plan is a declared recipe ([07-deferred.md](07-deferred.md)).

**Adding a role requires an ADR.** An actor that shares its lane, its states, its tool authority, its
model tier and its output kind with an existing one is a prompt variant, not a role. The word "swarm"
invites this mistake.

## Isolation

The **Rehearsal Room** is a container ([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md)):

| Property | Rule |
| --- | --- |
| Host filesystem | **No host path is mounted in.** Files enter and leave through the provider interface |
| Credentials | **None, of any kind.** Git writes and model calls happen control-plane side ([ADR-0015](03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)) |
| Egress | **Denied by default.** A declared allowlist holds the package registries a recipe needs. Every decision, allowed or denied, is a Prompt Book entry |
| The model endpoint | **Not on the room's allowlist.** Reachable from the control plane only, so injected repository content cannot spend budget or reach a model |
| Resources | Explicit CPU, memory, process-count and disk limits, and a per-execution timeout |
| Lifetime | One room per Scene, destroyed when the Scene ends or the room goes idle |
| Runtime missing | **Refuse to execute.** There is no fallback to a weaker runtime |

The egress allowlist is what closed the question of how a dependency upgrade obtains its new package
version: it resolves from a registry on the list. The cost is stated rather than hidden — a container
escape is a host compromise, and an allowlist is a channel where no network was not
([ADR-0006](03-adr/0006-no-network-in-verification-sandbox.md) is the argument for keeping it narrow).

**MicroVM isolation is deferred**, and the trigger is a client requiring it at a security review
([07-deferred.md](07-deferred.md)).

### Between clients

**Separation, not predicates.** One isolated instance per client: their own database, object store,
execution host, configuration and credentials
([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)). There is no shared runtime, no
tenant column and no row-level security, because there is nothing to separate inside a single
instance.

This is a deployment property, checkable by looking at what is running, rather than an invariant that
must hold in every query anyone ever writes. It costs marginal efficiency per client and it removes
the class of failure where one client's source reaches another.

## Repository access

Scenio authenticates as **its own scoped application installation**, never a person's access token
([FR-122](03-requirements.md), [ADR-0027](03-adr/0027-scoped-application-identity-branches-only.md)). A
token carries the human's privileges rather than Scenio's, makes attribution in the client's own
history wrong, and turns their offboarding into our outage.

The envelope is enforced where requests are constructed, so a git host misconfiguration granting more
does not widen behaviour, and there is one test per prohibition
([FR-123](03-requirements.md), [NFR-035](03-requirements.md)).

**May:** read repository contents and history; create and update branches under a reserved prefix;
open, update and comment on Previews it opened; comment on a human's Preview; read diffs, review
comments and check results.

**Must not:** push to a default or protected branch — *including on explicit instruction*
([FR-010](03-requirements.md)); force-push any ref; delete or rename a branch; create or move a tag or
release; alter branch protection, repository or organisation settings; read CI secrets; merge; enable
auto-merge; dismiss a review; **submit an approving review** — an approving review is a merge enabler,
and Scenio does not participate in the merge decision even advisorily.

**A missing or revoked permission parks the Scene and is never retried**
([FR-126](03-requirements.md)). A permission error is a statement about authority, not availability. No
fallback credential, no alternative ref, no degraded delivery — the same shape as the isolation
runtime's refusal, for the same reason: a silent workaround makes a documented boundary false while
every test still passes.

## Concurrency

**Scenes run in parallel. Conflicts are detected at merge and the loser re-runs**
([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)). There are no exclusive path
claims and no waiting state whose cause is another Scene.

The mechanism is one that already exists: a patch applies by **exact match**, so a tree that moved
underneath it produces a rejection naming the file and the nearest candidate, never a fuzzy apply
([FR-035](03-requirements.md)). A Scene whose patch is rejected that way is **re-planned against the
current head**, and the re-plan is a recorded Prompt Book entry rather than a silent retry
([04-contracts.md](04-contracts.md), CON-04).

A re-run consumes the Scene's normal bounds — admission control, the attempt cap, the progress oracle
— so a conflict cannot become an unbounded loop. **The re-run rate is measured**
([NFR-044](03-requirements.md)) because it is the number that decides whether this was the right
trade: above roughly one Scene in five, exclusive claims become cheaper again.

There is **no automatic conflict resolution** and no three-way merge. A merge resolution that passes
the suite is not evidence that it was the right resolution; re-planning from the current head produces
a change an agent actually decided on.

## The Prompt Book

The **Prompt Book** — the append-only audit log — is the source of truth. Everything else is derived.

Every execution and every model call has an entry, written **in the same transaction as the effect it
records** ([FR-063](03-requirements.md)). If it cannot be logged, it does not happen. There is no
update path and no delete path ([FR-062](03-requirements.md)); a correction is a new entry that
references the earlier one.

That completeness is what makes three different questions answerable without an investigation: *what
did it execute*, *what did it cost*, and *what could it have reached*. It is also what **Box Office**
is computed from.

## Box Office

**Box Office** — the four effectiveness numbers — is the only reporting surface a buyer needs, and it
exists from the first client ([FR-130](03-requirements.md)).

| Number | Definition |
| --- | --- |
| Acceptance rate per task class | Previews merged with no human edit ÷ Previews opened |
| Cost per merged Preview | tokens plus compute ÷ Previews merged |
| Human intervention rate | Scenes that reached Held ÷ Scenes started |
| Evidence rate in the judgement lane | comments with an artifact ÷ comments posted |

Three rules make the numbers trustworthy:

**Every figure is computed from the Prompt Book by a query that is published.** No rollup table, no
cached figure, no number a model produced. A client who disbelieves a figure can run the query.

**Every figure carries the count it came from.** A 100% acceptance rate over two Previews is not a
100% acceptance rate ([FR-132](03-requirements.md)).

**Insufficient data says so.** Never 0%, never a flattering percentage over three samples.

All four values are **TBD** — no measurement exists yet, and inventing one would be worse than an
empty field ([NFR-043](03-requirements.md)). The measurement is defined; the number is not.

**Activity is not effectiveness.** Scenes run, comments posted and Previews opened are operational
counters for whoever runs the instance. They are excluded from Box Office, because activity measures
what Scenio did and effectiveness measures what the client got.

## The Booth

The **Booth** — the administration console — is minimal in v1: the Scene list, the Scene detail with
its Prompt Book entries and cost, The Call, and Box Office. Server-rendered, no separate frontend
build ([ADR-0028](03-adr/0028-web-console-as-a-product-surface.md)).

**No surface executes anything on demand.** No "run this", no "force this transition", no "retry", no
"approve all", no editing a Prompt Book entry. The Booth is a view and a decision surface over the
same API, and it has no endpoint the API does not.

Its display rules are product requirements with tests, not styling
([FR-132](03-requirements.md)): the three verification words; Held rendered as waiting with its
reason and never as a spinner; unknown rendered as "unknown" and never as zero; the lane visible
before the content; a `demonstrated` comment rendered differently from an `unverified` one; and a
measure with too few observations rendered as "insufficient data" with its count.

## The seams that survive the cut

A seam is a small piece of work done now so that a later phase is additive. Three survive
([07-deferred.md](07-deferred.md) holds the rest):

**The execution provider.** One interface, six operations, and only the execution-provider module
may know which runtime is behind it. Swapping a container for a microVM means implementing the same
six operations and passing the same escape suite unchanged.

**The model provider.** Calling code names a capability tier; only the provider adapter may name a
vendor. One OpenAI-compatible adapter serves hosted and local endpoints, and no default endpoint is
compiled in ([ADR-0012](03-adr/0012-model-tiers-and-provider-abstraction.md)).

**Pure decisions.** Routing predicates and guards take data and return a decision: no IO, no clock
read, no randomness ([ADR-0002](03-adr/0002-langgraph-as-executor-with-pure-routing.md)). Time enters
as an event delivered by the driver. This is what makes a historical Prompt Book replayable through
current logic to prove a fix, and it is the single most damaging rule to break because nothing
observable changes when it is.
