# Open questions

**Three.** Down from 23 ([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)). Twenty were
closed: seventeen answered by decisions, which now live in the ADR or the requirement they produced,
and three retired alongside scope that is deferred ([07-deferred.md](07-deferred.md)).

These three are **commercial bets, not technical ones**. Each has a provisional position that the whole
specification is written on, and each would take part of the specification with it if it flips. They
stay open because the exposure should be visible, not because the documents are undecided.

An agent that hits one MUST NOT invent an answer. Work on the provisional position and say so.

---

## OQ-11 — Is dependency and CVE work the right first lane?

**The question.** The verified lane could be dependency upgrades and CVE remediation, or it could be
large mechanical migrations — the JavaScript-to-TypeScript conversion the earlier vision led with.

**Provisional position, which everything is written on.** Dependency upgrades and CVE remediation,
verified by the repository's own existing test suite. Chosen for the cleanest available oracle: the CVE
disappears from the dependency tree and the suite stays green, both machine-checkable. Diffs are small,
so human review is cheap; the work recurs, so it supports a subscription; and it is the thing every
team postpones.

**What changes if it flips to large migrations.**

| Document | What changes |
| --- | --- |
| [01-product.md](01-product.md) | The problem statement, the client profile and the winning condition. A migration client is buying completion of a project, not removal of a recurring chore |
| [03-requirements.md](03-requirements.md) | [FR-083](03-requirements.md) — manifest and lockfile consistency — becomes irrelevant and is replaced by whatever the conversion's oracle needs. [FR-080](03-requirements.md)'s declared paths get much wider, which weakens it as a blast-radius control |
| [05-roadmap.md](05-roadmap.md) | **M2's exit criteria change entirely.** "Ten real upgrades across three repositories" is not a migration test; a migration needs a campaign, and a campaign needs the machinery that is currently deferred |
| [07-deferred.md](07-deferred.md) | **Shows as long-running campaigns come back into v1.** A codebase conversion is not one Scene and not ten; it is a campaign with a progress measure, ceilings and a completion condition ([ADR-0024](03-adr/0024-worksites-as-long-running-campaigns.md) is the design to revive) |
| [ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md) | **Probably reverses.** Optimistic concurrency was chosen because dependency diffs are small and collisions rare. A conversion touches far more of a tree, so the collision assumption does not transfer and exclusive claims may be correct again |

So this question does not move a paragraph. It moves M2, reinstates a deferred capability, and reopens
a decision taken this week.

**What would settle it.** Three conversations with teams that fit the client profile in
[01-product.md](01-product.md), asking which of the two they would pay for **this quarter** — not which
sounds more valuable. A team that has been meaning to convert to TypeScript for two years and has not
is telling you something about urgency; a team that patched a CVE by hand last week is telling you
something else.

**Cheaper evidence, available sooner:** connect three real repositories and count how many CVEs are
outstanding in each. If the answer is one or two, the recurring-work premise is weaker than it looks.

---

## OQ-15 — Does the security-perimeter argument lead, or follow?

**The question.** Is "your source never leaves your infrastructure" the primary reason a client buys,
a secondary reassurance, or not part of the pitch?

**Provisional position, which everything is written on.** **Secondary.** The primary argument is
*maintenance work that is verified, and approved by a person*. The perimeter argument becomes an FAQ
answer and a section in the security documentation. It is relegated because hosted-first with one
instance per client means the hard version of the claim — the source never leaves the client's own
network — is no longer true, and because a five-to-fifty-engineer team is not usually buying on that
axis.

**What changes if it flips back to primary.**

| Document | What changes |
| --- | --- |
| [01-product.md](01-product.md) | The lead argument, the client profile and the non-goals. A regulated buyer is a different reader with a different first question |
| [02-architecture.md](02-architecture.md) | Isolation moves from a section to the spine. The threat model, the named adversaries and the egress story all need the depth the cut removed |
| [ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md) | **Reverses.** Hosted-first is only correct if the perimeter argument is secondary. A client whose contract forbids sending source to a third party cannot use a service we operate at all, so **self-hosted becomes first, not second** |
| [ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md) | **Probably reverses too.** Container isolation was sized to the threat that remains after instance separation. A regulated buyer at a security review is the exact trigger this ADR names for microVM isolation, and the egress allowlist becomes much harder to justify than no network at all |
| [05-roadmap.md](05-roadmap.md) | **M3 changes shape.** "One paying client, one instance, one month" becomes an installation at a client site, which needs an installer, a supported host matrix and an upgrade path — none of which is in v1 |

This is the most expensive of the three if it flips, because it takes two decisions and a milestone
with it and reintroduces work the cut removed.

**What would settle it.** The composition of the founder's own network. If the reachable prospects are
mostly fintech, health or public-sector suppliers, the perimeter argument is the strongest asset
available and hosted-first is the wrong order. If they are mostly product companies of five to fifty
engineers, secondary is right.

**The measurement to prefer over the judgement:** in the first three sales conversations, count how
many raise data location **before** being prompted. Raising it unprompted is the signal; agreeing that
it matters when asked is not.

---

## OQ-19 — Is the narrow chat entry point enough?

**The question.** Front of House — the chat entry point — can offer a **closed list** of maintenance
types described in natural language, or it can accept **any** change request. The second needs
generated planning: a specification, a task breakdown and a verification command produced per task.

**Provisional position, which everything is written on.** **The narrow version**, and it is written
that way everywhere. Front of House means: pick a declared kind of maintenance, in natural language, or
get a decline with a reason from a closed set. It does **not** mean "describe any change".

Front of House itself is deferred in v1 ([07-deferred.md](07-deferred.md)); this question is about what
it will be when it exists, and it is open now because the answer changes what is being sold before
anything is built.

**Why this one is different from the other two.** It is not a bet about what clients want — it is
already known that they would prefer the wide version. It is an admission that the narrow version is a
**real reduction** from the vision the project started with, not a postponement. The owner has
accepted that, and the honest framing is that something was given up rather than scheduled.

**The selling rule that follows, which is not optional.** **Never demonstrate Front of House without
saying, in the same sentence, that the list of maintenance types is closed.** The two versions look
identical in a demo and diverge the first time somebody asks for something no recipe fits.
Demonstrating one and delivering the other loses a client in week two.

**What changes if it flips to the wide version.**

| Document | What changes |
| --- | --- |
| [01-product.md](01-product.md) | The non-goal "not a chat product" and the description of what Front of House is |
| [02-architecture.md](02-architecture.md) | An Architect actor returns, which [ADR-0032](03-adr/0032-three-actors-two-roles.md) removed. That is a new role and by that ADR's own test it needs an ADR |
| [03-requirements.md](03-requirements.md) | **[FR-081](03-requirements.md) is contradicted.** "Zero model calls spent on planning" is the requirement that says the plan is a declared recipe. Generated planning is precisely the opposite |
| [07-deferred.md](07-deferred.md) | Generated planning, the Architect, and the four deferred user stories about submitting a free-text request all come back |
| [ADR-0020](03-adr/0020-technical-debt-remediation-as-the-v1-product.md) | Its central scope choice reopens, and with it the question it closed: whether a verification command can be produced reliably per task |

**What would settle it.** The measurement is already specified even though the capability is not:
**the frequency of the `requires_generated_plan` decline reason.** When Front of House is built, a
request that fits no recipe is declined with that reason, recorded and indexed
([ADR-0025](03-adr/0025-chat-front-door-request-broker.md)). If most declines cluster there, the narrow
door is not the product; if they cluster on entitlement or ambiguity instead, it is.

Building the instrument before answering the question is deliberate and cheaper than guessing. Note
what it means for sequencing, though: this question **cannot** be settled until Front of House exists,
so it stays open through all three milestones.

---

## What the closed questions became

For a reader who remembers the previous 23 and wants to know where each went.

**Answered by a decision** — the reasoning now lives in the ADR, not here: the deployment shape and
tenancy ([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)); the isolation boundary and
how a dependency upgrade reaches a package registry
([ADR-0030](03-adr/0030-container-isolation-with-egress-allowlist.md), which closed two questions at
once); the first judgement-lane task and the evidence constraint
([ADR-0023](03-adr/0023-advisory-findings-carry-evidence.md)); the actor list
([ADR-0032](03-adr/0032-three-actors-two-roles.md)); concurrency between Scenes
([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)); the console's first version
([ADR-0028](03-adr/0028-web-console-as-a-product-surface.md), partly suspended); and the scale target,
which one instance per client answers by construction.

**Retired with scope** — they existed only because of something now deferred, and they reopen if it
returns: [07-deferred.md](07-deferred.md) lists each one against the scope it belongs to.

**One thing the decisions did not cover**, and it is a gap rather than a question with a provisional
answer: **there is no price.** M3 requires a paying client, and hosted operation with one instance each
means the cost per client is not near zero. It is recorded in
[07-deferred.md](07-deferred.md) as a prerequisite the documentation does not supply, rather than
carried here as a fourth open question — because it is not a bet to be resolved by evidence, it is a
decision nobody has made yet.
