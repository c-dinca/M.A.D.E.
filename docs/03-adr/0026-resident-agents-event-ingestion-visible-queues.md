# ADR-0026 — Residency is a property of the control plane: durable ingestion and visible queues, not immortal agents

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), NFR-021, [ADR-0003](0003-postgres-as-system-of-record.md), [ADR-0004](0004-event-log-separate-from-checkpoints.md), [17-persistence-and-concurrency.md](../02-architecture/17-persistence-and-concurrency.md), FR-115 to FR-121

## Context

The new vision describes "a swarm of AI agents that lives inside the company's development
infrastructure", reacting to events and running several worksites in parallel. The current
architecture is request-oriented: one request, one Run, one execution, done. A Run is created, it
advances, it terminates, and nothing in the system waits for anything.

Two readings of "lives inside" are available and they have opposite consequences.

The first is literal: long-lived agent processes, each holding context, watching the repository,
accumulating an understanding of the codebase. This is the shape the phrase suggests and it is
incompatible with almost everything in this repository. An agent holding context across Runs is
unlogged influence, which breaks [UF-5](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)
and is exactly what Seam 7 forbids. A process that decides for itself when to act has no admission
control point, which breaks [UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures).
And per-role processes were already rejected in
[01-system-overview.md](../02-architecture/01-system-overview.md#rejected-architectures) because roles
are prompts plus tool grants, not workloads.

The second reading is behavioural: from the customer's point of view the system is always there,
noticing things and getting on with work, without anybody submitting a request. That is a property of
durable ingestion, durable schedules and durable queues. It requires no immortal agent and no carried
context.

There is also a specific rule to confront rather than skirt.
[03-api-design.md](../02-architecture/03-api-design.md) refuses to queue: exceeding the concurrency
limit returns `429` "because an invisible queue makes cost and latency unpredictable and violates the
honest-failure principle. The client decides whether to wait." That is correct for a human calling an
API. It is unworkable for a system that reacts to events, because there is no client to decide.

## Decision

**Residency is behavioural, not architectural.** Agent invocations remain stateless: an agent is
constructed per State entry, receives artifacts, produces an artifact, and is discarded (FR-115). No
agent process outlives a Run, no agent holds context between Runs, and nothing an agent concluded
reaches a later Run except as a named artifact with a digest. The swarm is delivered by the control
plane, not by the agents.

**Work arrives through a durable ingress** (FR-116). Every inbound trigger — a pull request opened or
updated on a target repository, a push to a default branch, a chat request, a schedule window, a
worksite cycle — is recorded as an **ingress event** before anything acts on it. Ingestion is
idempotent on the provider's delivery identifier, so a redelivery produces no second Run. An ingress
event that cannot be recorded is not acted on, which is
[09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md)'s rule applied at the boundary.

**Queues are permitted and MUST be visible** (FR-117). This reverses the `429`-instead-of-queueing rule
for internally generated work, and the honest-failure principle is preserved by a different mechanism:
every queued item is a row with a position, an age, a reason for waiting and a cause, exposed in the
console and countable in a metric. Nothing is queued invisibly, no queue is unbounded, and a queue
that reaches its bound sheds work with a recorded reason rather than growing. Human-submitted API
requests keep the existing `429` behaviour, because there a caller can decide.

**Scheduling is durable and pure at the decision point** (FR-118). Schedules and worksite cycles live
in Postgres, survive restarts, and do not silently backfill: a missed window is a recorded event with a
reason, never a burst of catch-up Runs. The scheduler is a loop inside the existing worker.

**Concurrency and resources are governed at four levels** (FR-119): deployment, tenant, project and
worksite. Each level has a concurrent-Run cap and a spend ceiling, and admission is checked at every
level before a Run is created, not after. A tenant cannot exhaust another tenant's capacity, and a
worksite cannot exhaust its project's.

**The process-kind ceiling holds** (FR-120, [NFR-021](../01-product/04-non-functional-requirements.md)).
No new long-running process kind is introduced. Inbound ingestion is a set of routes on `api`; the
scheduler, the worksite driver, the chat egress effect and the reaper are loops and effect handlers
inside `worker`; the queue is a table in `postgres`. Replicating `api` or `worker` horizontally is not
a new kind — this is a clarification of NFR-021, recorded here because the previous wording counted
processes rather than kinds and would otherwise be read as forbidding a second worker.

**State that survives between Runs lives in exactly three places** (FR-121): the git repository, the
append-only event logs (Run and worksite), and versioned configuration rows. There is no fourth store,
no cache of conclusions, and no vector index.

## Alternatives considered

### Long-lived per-role agent processes holding context — rejected

The advocate's case is the most interesting one here and it is not weak. An agent that stays resident
can build genuine familiarity with a codebase: it learns which modules are fragile, which tests are
flaky, which patterns the team prefers. That knowledge is expensive to rediscover per Run and it is
plausibly where the largest quality gains in this whole system are. It is also what "a swarm that
lives in your infrastructure" most naturally means, and the phrase came from the founder.

It loses to auditability, which is a v1 gate rather than a preference. A resident agent's behaviour
depends on state that is not in any event log, so "why did it do that" becomes unanswerable and a Run
stops being explainable from its own record — the failure
[09-audit-and-replay.md](../02-architecture/09-audit-and-replay.md) and Seam 7 both exist to prevent.
It also has no natural admission-control point: a process that decides for itself when to act cannot
be bounded by a per-Run ceiling. The knowledge argument is answered, partially and honestly, by a
different mechanism — the evaluation corpus and the attempt records accumulate learning *in tests and
artifacts*, where it is inspectable. That is less powerful and it is the trade being made.

### Keep refusing to queue, returning a busy signal to every internal trigger — rejected

The case is consistency with a rule that was argued well: an invisible queue makes cost and latency
unpredictable, and dropping work loudly is better than accumulating it quietly.

Rejected because there is no caller to receive the refusal. A pull request opened while the deployment
is at capacity would simply never be reviewed, silently, which is a worse violation of the same
principle. The rule's *purpose* — nothing waits invisibly — is preserved by making the queue a
first-class, inspectable object with bounds, which is strictly more honest than dropping the event.

### Introduce a message broker for ingestion and scheduling — rejected

A real case: Postgres `SELECT … FOR UPDATE SKIP LOCKED` is a queue built by hand, and a broker gives
delivery semantics, retries, dead-letter queues and backpressure for free. At the volumes hosted
multi-tenant operation implies, this is the conventional answer and the one most engineers would
reach for.

Rejected on the same grounds [ADR-0003](0003-postgres-as-system-of-record.md) and
[11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md) already used, and
one additional one that matters more now: every effect in this system must be written in the same
transaction as its event. A broker outside the database cannot participate in that transaction, so
either the audit guarantee weakens or a two-phase reconciliation is written — which is more work than
the queue table. The revisit trigger is a measured one and it is recorded below.

### Poll the git host instead of accepting inbound events — rejected as the only mechanism, retained as a fallback

The case: polling needs no inbound surface at all, which is a genuine security advantage for a
self-hosted install behind a firewall, and it removes an entire class of delivery-verification bugs.

Rejected as the only mechanism because latency on a pull-request review is user-visible and a poll
interval short enough to feel responsive is a rate-limit problem on every repository. Retained as a
configured fallback: a deployment that cannot accept inbound connections polls, with the latency
consequence stated rather than hidden.

## Consequences

### Positive

The system becomes reactive without acquiring an unauditable component, and every existing guarantee —
one Sandbox per Run, an event per effect, admission before every model call, a Run explainable from its
own log — survives unchanged. Governing concurrency at four levels is the mechanism multi-tenant
operation needs anyway ([ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md)), so it is
not a cost paid only for residency. Keeping the queue in Postgres keeps the process-kind ceiling and
the one-operator property intact. And making queues visible turns waiting into a fact the operator can
see instead of latency they have to guess at.

### Negative — mandatory

**The system now has a component that runs when nobody asked it to**, which is the largest change to
the risk profile in this whole revision. Under the old design, spend required a request. Now an
ingress event can start work, and a misconfigured schedule, a chatty repository or a redelivery storm
becomes budget. The four-level admission check is what stands between that and
[UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures), and it is new code.

**We refused the resident-agent reading of the founder's vision.** That should be stated plainly rather
than resolved by definition: the quality gains a context-carrying agent might deliver are not available
under this decision, and if they turn out to be large, this ADR is what is in the way.

**A hand-built queue in Postgres will need the things brokers provide**: retries, dead-lettering,
poison-message handling, backpressure, fairness between tenants. Each will be added under pressure, in
SQL, by one person, and the fairness one in particular is genuinely hard.

**Ingress is an availability dependency with no good degraded mode.** If ingestion stops, nothing
visibly fails — work simply does not happen, which is the quietest possible failure and precisely the
kind this project treats as unacceptable. It needs its own alert, which competes for one of the eight
slots in [NFR-022](../01-product/04-non-functional-requirements.md).

**Reasoning about the system's behaviour now requires reasoning about time.** Schedules, TTLs, queue
ages and worksite cycles all involve clocks, and the purity rule
([ADR-0002](0002-langgraph-as-executor-with-pure-routing.md)) says a clock read must never enter a
routing predicate. Every one of these mechanisms is therefore a place where the most damaging mistake
in the codebase can be made, and there are now several more of them.

**NFR-021 has been reinterpreted rather than met on its original terms.** Counting kinds instead of
processes is defensible and it is also a loosening, and the honest reading is that the process budget
is now under more pressure than it was.

## Revisit when

Either: measured queue depth, redelivery volume or tenant-fairness complaints exceed what a Postgres
queue table handles cleanly — the trigger is a specific measurement, sustained queue wait at p95 above
the value the console reports as acceptable, not a feeling that a broker would be nicer; or a design
exists in which carried agent context enters a Run as a **logged artifact with a digest**, which is the
same trigger Seam 7 already names and would reopen the resident-agent question with the auditability
objection answered.
