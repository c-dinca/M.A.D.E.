# AGENTS.md — operating rules

Read this before anything else. It is short on purpose.

## What Scenio is

**Scenio does maintenance work that a command can prove, and a human approves the result.**

v1 is one kind of work in each of two lanes and nothing else
([ADR-0033](docs/03-adr/0033-one-verified-lane-one-judgement-lane.md)):

**Verified** — dependency upgrades and CVE remediation, decided by the repository's own existing test
suite. A command declared before the work starts, executed unmodified; its exit code is the only thing
that decides.

**Judgement** — review of a human's Preview (their pull request), through evidence only. The Prompter
writes the test that fails and demonstrates the problem, or it marks the comment *unverified*.
**Judgement output carries no correctness guarantee.**

The failure to prevent, in one sentence: **judgement output borrowing the credibility of verified
output.** The pressure will not come from an attacker. It will come from whoever is trying to make a
summary look tidy, and it will arrive as a reasonable request.

## Read this much, and no more

[docs/01-product.md](docs/01-product.md) for the vocabulary, then
[docs/02-architecture.md](docs/02-architecture.md), then the requirement your item claims. Eight
documents exist and they can be read end to end; there is no reading path to follow because there is
nothing to skip.

## Source of truth, in order

1. **[`/contracts/`](contracts/)** — normative.
2. **Accepted ADRs** in [docs/03-adr/](docs/03-adr/README.md).
3. **The eight documents** in [docs/](docs/).
4. **Existing code** — the last thing to trust.

> **One exception is live and you must know it.** The contracts describe a **larger** product than v1
> and predate three decisions: one instance per client, container isolation with an egress allowlist,
> and optimistic concurrency. **An agent implementing from `/contracts/` today would build the wrong
> product.** `CON-01` to `CON-06` in [docs/04-contracts.md](docs/04-contracts.md) fix that and they
> land **alone and first**. Until the relevant one has merged, an implementation item touching that
> entity is **not ready — stop and report.**

## The five unforgivable failures

**UF-1** code escapes the Rehearsal Room · **UF-2** a Scene consumes unbounded money or time ·
**UF-3** Scenio reports success it cannot prove · **UF-4** source or a secret leaves the perimeter the
client authorised · **UF-5** a Scene cannot be explained afterwards.

A change that weakens any of these is rejected regardless of what else it achieves.

## Non-negotiable rules

### Isolation and access (UF-1, UF-4)

- **Never add a fallback for a missing runtime.** If it is unavailable, Scenio refuses to execute. A
  silent downgrade makes the central claim false while every test still passes
  ([FR-055](docs/03-requirements.md)).
- **Never put a credential inside a Rehearsal Room.** Not a short-lived one either
  ([FR-056](docs/03-requirements.md), [ADR-0015](docs/03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)).
- **Never mount a host path into a Rehearsal Room.**
- **Never widen the egress allowlist to make something work.** It is deny-by-default, it holds package
  registries and nothing else, and **the model endpoint is never on it** — that is what keeps injected
  repository content from spending budget ([FR-057](docs/03-requirements.md)). Read
  [ADR-0006](docs/03-adr/0006-no-network-in-verification-sandbox.md) before widening it; it is the
  argument for keeping it narrow.
- **`exec` takes an argv vector, never a command string.** A string interface invites interpolation.
- **Never accept a human's access token** as a repository credential
  ([FR-122](docs/03-requirements.md)).
- **Never widen the permission envelope.** No default-branch push, no force-push, no branch deletion,
  no tags, no settings, no CI secrets, no merge, no auto-merge, no approving review. Each prohibition
  has a test ([FR-123](docs/03-requirements.md), [NFR-035](docs/03-requirements.md)).
- **Never retry an authorisation failure.** A missing permission is a statement about authority, not
  availability. It makes the Scene Held, with no fallback credential and no alternative ref
  ([FR-126](docs/03-requirements.md)).
- **Never add a capability to make something work.** That is an ADR, not a configuration change.

### Termination and cost (UF-2)

- **Routing predicates and guards are pure.** No IO, no `datetime.now()`, no randomness
  ([ADR-0002](docs/03-adr/0002-langgraph-as-executor-with-pure-routing.md)). Time enters as an event
  delivered by the driver. This is the single most damaging rule to break, because **nothing
  observable changes when it is** — replay silently stops reproducing production.
- **Never raise a cap or a ceiling to make something finish**
  ([FR-039](docs/03-requirements.md), [FR-049](docs/03-requirements.md)).
- **Every model call passes admission control before it is made.**
- **Every effect that spends money or executes code carries an idempotency key.**
- **No self-loops.** Every failure path ends in Held or a terminal state.

### Truthfulness (UF-3)

- **The verification exit code is the only definition of success**
  ([FR-033](docs/03-requirements.md), [ADR-0014](docs/03-adr/0014-verification-oracle-is-authoritative.md)).
- **Never make verification more forgiving to get a Scene to pass.** This will be tempting, because a
  failing Scene looks like your bug ([FR-034](docs/03-requirements.md)).
- **Never fuzzy-match a patch so it applies** ([FR-035](docs/03-requirements.md)). Silent corruption is
  worse than a rejection — and that rejection is also the conflict detector that makes parallel Scenes
  affordable ([ADR-0031](docs/03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)).
- **Report in three words:** *verified*, *failed verification*, *not verified*. **Those words are
  reserved for the verified lane.** Held is "waiting for approval", never a spinner. Unknown is
  "unknown", never zero ([FR-132](docs/03-requirements.md)).
- **Never describe a judgement Scene in those three words**, never render an `unverified` comment like
  a `demonstrated` one, and never blend a Box Office figure across lanes.
- **Every comment carries evidence or the word *unverified*.** Never both absent — and **never
  suppress a concern to avoid the label**, because a reviewer reading only demonstrable comments
  reasonably concludes nothing else was found ([FR-088](docs/03-requirements.md)).
- **An evidence record is not a verification result.** Distinct storage, distinct event kind.
  *Demonstrated* is a claim about a command; *verified* is a claim about a Scene.
- **Never show a percentage without its count**, and never render 0% where the honest answer is
  "insufficient data".
- **Never invent a number.** Box Office's four measures and the re-run rate are `TBD` with the
  measurement defined ([NFR-043](docs/03-requirements.md), [NFR-044](docs/03-requirements.md)).
  Closing a milestone by choosing a value is a failure, not a shortcut.

### Auditability (UF-5)

- **Every effect writes its Prompt Book entry in the same transaction.** If it cannot be logged, it
  does not happen ([FR-063](docs/03-requirements.md)).
- **Never add an update or delete path for a Prompt Book entry.** A correction is a new entry
  referencing the earlier one ([FR-062](docs/03-requirements.md)).
- **Never read a framework checkpoint on an audit or reporting path**
  ([ADR-0004](docs/03-adr/0004-event-log-separate-from-checkpoints.md)).
- **Never build a rollup table for a Box Office figure.** Every one is a published query over the
  Prompt Book. A second source of truth for the product's own value claim is a trust failure
  ([FR-130](docs/03-requirements.md)).
- **Event evolution is additive only.**

### Scope

- **Never build anything in [docs/07-deferred.md](docs/07-deferred.md).** Campaigns, Show templates,
  Front of House, generated planning, extra roles, multi-repository work, self-hosted packaging,
  scheduling, residency, an evaluation harness, the Booth beyond four pages.
- **Never add an actor.** Three exist, two are roles
  ([ADR-0032](docs/03-adr/0032-three-actors-two-roles.md)). An actor sharing its lane, states, tool
  authority, tier and output kind with an existing one is a **prompt variant, not a role**. The word
  "swarm" invites this mistake, and adding one requires an ADR.
- **The Stage Manager is code.** It holds no prompt and calls no model. Its lack of judgement is what
  makes the exit code mean something. Do not give it one.
- **Never promote judgement output into the verified lane.** A comment does not become a Scene, and no
  transition exists from the judgement sub-graph into the change step.
- **Never accept work with no runnable check.** "Improve quality", "modernise this module", "make it
  faster". In the verified lane they are refused; in the judgement lane they are refused as *tasks* and
  permitted only as comments carrying evidence or marked unverified.
- **There is no tenancy.** One isolated instance per client
  ([ADR-0029](docs/03-adr/0029-hosted-first-one-instance-per-client.md)). Do not add a `tenant_id`
  column, a row-level-security policy or a tenant prefix. This **reverses** the previous rule and is
  the change most likely to be got wrong by an agent working from memory.

## Vocabulary

Use the Scenio terms exactly, in code, database columns, API fields, event kinds, log fields and
user-facing text ([docs/01-product.md](docs/01-product.md) has the table).

`house` not project or repo · `scene` not run or job · `preview` not pr · `prompt_book` not log ·
`rehearsal_room` not sandbox or container · `held` not await_human · `dropped_cue` not aborted ·
`show` not campaign or worksite · `box_office` not dashboard.

Two rules that are not optional:

**A theatre term never appears alone.** It is a heading with a plain-language description beneath it,
every time. `Prompt Book — the append-only audit log of every Scene.`

**Never `Production` for a Show.** In a developer tool that word means the live environment. Use it
only when that is what you mean.

## Git and pull requests

Branch `<item-id>-<short-slug>`. Conventional commit subject, imperative, with a `Refs:` footer naming
the item and the requirement ids. Squash merge.

**Contract changes land alone and first.** A pull request touching `/contracts/` contains only that
change plus its schema tests. This is currently a hard gate on everything.

## The working rule

> **No new commits in `docs/` until code runs against a real repository.**

The specification is finished. Every new document is a day Scenio does not exist. An **ADR is the
exception** — a decision that is not written down gets made again, usually differently. Growth is
depth inside the eight documents, not new files.

## Open questions

Three, and only three ([docs/06-open-questions.md](docs/06-open-questions.md)): **OQ-11** (is the CVE
lane the right first bet), **OQ-15** (does the perimeter argument lead), **OQ-19** (is the narrow chat
door enough). They are commercial bets and only the owner can settle them.

**Do not invent an answer.** Work on the provisional position stated in the block, and say which one
you assumed.

## Do not fabricate

Do not invent statistics, prices, benchmark figures, regulations, standards, market sizes or
institution names. **This extends to our own numbers**: where a measure has no basis, the requirement
states the measurement and the value is `TBD`. A confident invented number propagates into decisions
that look justified.

## When you are stuck

**Stop after two failed attempts at the same approach.** Report: what you tried, both times,
concretely; the actual error or failing assertion, not your interpretation of it; your suspected root
cause; and two plausible next steps.

**Never** weaken a test, loosen an assertion, add a tolerance, skip a case, raise a cap, relax the
`unverified` label, blend two lanes into one number, or silently reduce scope. A blocked item reported
honestly is worth more than a green pull request that quietly does less than it claims — which is
exactly the failure this product exists to eliminate, so producing it here would be self-defeating.
