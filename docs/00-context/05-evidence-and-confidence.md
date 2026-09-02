# Evidence and confidence: what is proven, what is assumed

This specification was written by a machine. So will the specification bundles be, if
[ADR-0019](../03-adr/0019-specification-first-projects.md) is ever accepted. The obvious question is
how anyone knows a generated specification is right, and the honest answer is that nobody does — so
the useful question is narrower: **which claims here are established, by what, and when do the rest
become known.**

This document exists because "the specification is authoritative" is a dangerous sentence unless it is
qualified. An agent reading a provisional number as though it were measured, or a strategic assumption
as though it were validated, will make decisions that look justified and are not.

## Four ways a claim here is established

**1. Proven by execution.** Something was run and it either worked or it did not. As of the last
commit:

| Claim | How it was proven |
| --- | --- |
| Every JSON Schema is valid and its cross-file `$ref`s resolve | Validated against the 2020-12 meta-schema with a real resolver registry |
| The OpenAPI document is valid | `openapi-spec-validator` |
| The DDL is syntactically valid Postgres | Parsed with `pglast` against the real grammar |
| **The DDL applies to a real database** | Executed against PostgreSQL 16: 15 tables, 33 indexes, 27 check constraints, 18 foreign keys |
| **The constraints that carry invariants actually reject bad data** | 23 hostile inserts probed against the live schema; all 23 rejected — including a mutable image tag (FR-008), a default-branch target (FR-010), a duplicate idempotency key (FR-021), a Task with an empty verification command (FR-024), event sequence 0 (INV-1), negative spend (INV-3), a duplicate attempt number (INV-4), a malformed digest (INV-5), a duplicate model-call idempotency key, and an argv field containing a shell string |
| The state machine is well-formed | No self-loops, no transition out of a terminal State, every State reaches a terminal State, every guard and tool referenced exists |
| The state enumeration agrees across contract, DDL, JSON Schemas and API | Asserted by comparison, not by reading |
| Every internal link and heading anchor resolves | 2,212 internal links and anchors checked after the 2026-09 rewrite; zero unresolved |
| Every diagram renders | 6 Mermaid diagrams compiled **before** the rewrite. The diagrams added by it — the container view, the component view, the `ASSESS` sub-graph, the worksite and request lifecycles — have **not** been compiled |
| Every requirement has an identifier and a named test method | 150 FRs (one **Withdrawn**) and 42 NFRs, each with an identifier and a Verified-by or Measured-by column. **Correction:** the previous version of this row claimed all of them were "referenced somewhere outside their own definition". That was **not true then and is not true now** — 11 FRs (FR-002, FR-003, FR-006, FR-007, FR-009, FR-013, FR-014, FR-015, FR-019, FR-020, FR-022) appear only in their own document, and the same 11 were unreferenced before the rewrite. They are Epic A and Epic B requirements no backlog item's acceptance criteria happen to cite. Not a defect in the requirements; a defect in the claim, corrected here rather than left flattering |
| Every referenced identifier is defined | 150 FRs, 42 NFRs, 23 OQs, 18 INVs all resolve; no identifier is referenced without a definition, and no FR or NFR is defined twice except FR-084, which is deliberately present struck-through in its epic and again in the Withdrawn table |
| Every backlog item declares Reading, Touches, Role, acceptance criteria and dependencies | 56 items checked **before** the rewrite. The items it added declare the same fields; the check has not been re-run mechanically |
| Every ADR records a rejected alternative and negative consequences | 19 checked before the rewrite; ADR-0021 to ADR-0028 each carry at least two steelmanned alternatives and a mandatory negative section, **not yet mechanically checked** |

**2. Internally consistent but externally unproven.** The largest category, and the one to be careful
about. The architecture does not contradict itself. Whether it *works* is untested — no line of the
system has ever run.

**3. Assumed, and marked.** Numbers chosen by judgement rather than measurement are labelled
**provisional** in [the NFR document](../01-product/04-non-functional-requirements.md). They are
enforced as gates anyway, because a gate that is occasionally re-tuned catches regressions while a
gate deferred until the number is certain never arrives.

**4. Unknown, and declined.** The [open questions](../05-delivery/02-backlog.md#open-questions) mark
places where the specification refuses to assert. An agent hitting one must stop rather than invent an
answer. **There are more of them after the 2026-09 vision change than before**, which is the correct
state for a product whose vision changed three weeks ago — a rewrite that closed them all would have
closed them by invention.

> **What the vision change did to this document's honesty budget.** The checks in category 1 above were
> run against the specification as it stood in August 2026. Everything ADR-0021 to ADR-0028 added —
> lanes, worksites, requests, tenancy, findings, evidence records, the console — is **category 2 at
> best**, and parts of it are category 3. Two specific consequences:
>
> **The contracts now lag the prose.** [`/contracts/`](../../contracts/) has no tenant column, no
> worksite, no request, no finding, no lane and no ingress event. Under the source-of-truth hierarchy
> in [`/AGENTS.md`](../../AGENTS.md) the contract wins and prose that contradicts it is a defect — so
> the prose describing these entities is, formally, describing something that does not yet exist in a
> normative form. This is recorded rather than hidden: the required contract changes are enumerated as
> contract-only backlog items, and they land alone and first
> ([05-delivery/02-backlog.md](../05-delivery/02-backlog.md)). Until they do, **no implementation item
> for a new entity is startable**, and the "proven by execution" table above must not be read as
> covering them.
>
> **The new numbers are marked TBD rather than guessed.** Where the vision change created a measure
> with no basis at all — the share of advisory findings that can carry evidence, an acceptable advisory
> acceptance rate, worksite cycle throughput — the requirement states the measurement method and the
> value is `TBD`. That is a departure from this repository's usual practice of setting a provisional
> gate anyway, and the reason is that a provisional number invented here would be indistinguishable
> from a measured one three documents later.

## What internal consistency does not buy

Consistency detects **contradiction**, not **error**. A specification can be flawlessly coherent and
completely wrong, and the checks above would pass unchanged. Specifically, nothing here proves:

- that the isolation runtime installs and holds on the platform this will actually run on (OQ-08);
- that any available isolation boundary is adequate for executing several tenants' code on one host
  (OQ-10);
- that the progress oracle refuses the right retries rather than too many or too few;
- that a 1,500-token repository map is enough context to locate a change in a real codebase;
- that an agent can produce a search/replace patch that applies often enough for the cost model to
  work;
- that an agent can write a failing test that demonstrates a bug it suspects, often enough for the
  evidence requirement to produce a useful review rather than a page of `unverified` labels;
- that a worksite's slice decomposition produces independently mergeable pull requests rather than a
  cascade of conflicts;
- that "merged with no human edit" can be measured correctly across rebases, squashes and concurrent
  commits — the headline number and the kill criteria both depend on it;
- that cost per successful outcome lands anywhere near a price a buyer would pay;
- that anybody wants this product.

The last one is the largest risk in the document and **no engineering milestone tests it.** Only a
customer does.

## The load-bearing unproven claims, ranked

Ranked by damage multiplied by likelihood, with the point at which each becomes known. This is the
list to argue with.

Updated by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): the product is
maintenance work on existing repositories, which **removed** the old third-ranked risk (whether a
verification command can be generated per Task — the oracle is the repository's existing suite) and
**added** OQ-09.

Updated again by the 2026-09 vision change, which **adds five** and does not remove any. The shape of
the list got worse, and that is the honest consequence of adding six capabilities at once: the new
entries are concentrated in the "discovered late, decides whether the business exists" half.

| # | Claim | If false | Known at | Cost of being wrong |
| --- | --- | --- | --- | --- |
| 1 | Someone will pay to have this work done unattended, rather than continuing to do it with people or accepting the debt | The strategy is wrong, not the architecture | Only at a design-partner conversation | Total. Nothing else matters |
| 1b | Buyers distinguish "unattended, budgeted, audited" from "we already have Cursor" | The positioning collapses into a comparison we lose on capability and price | First three sales conversations | Total, and it is the question to ask before writing more code |
| 1c | **Six capabilities can be built by one maintainer before the money or the attention runs out** | The product ships as six half-things, which is worse than one finished thing. This is the risk the vision change created and it is not a technical one | Continuously, and first at the M-numbered exit criteria | Total, and the mitigation is entirely in scope discipline: OQ-01, OQ-11, OQ-12 and OQ-13 exist to force one of each rather than all |
| 1d | **Advisory output is worth a reviewer's attention at machine volume** | The advisory lane adds review burden instead of removing it, which is the failure mode of the whole category | Only after enough humans have accepted or dismissed enough findings — it is statistically unfalsifiable in the short run ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)) | High. Half of the new scope. Narrow the class rather than lower the evidence requirement |
| 2c | **An isolation boundary adequate for multi-tenant execution exists and is affordable to operate** (OQ-10) | Hosted operation is suspended rather than the boundary weakened, which is the one direction this project does not trade ([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) | Before the first hosted tenant; testable early and cheaply, like OQ-08 | High, and it gates half of OQ-01's answer space |
| 2b | A dependency upgrade can obtain its new version without giving the Sandbox network access (OQ-09) | Either the no-network decision or the first work class has to change | Before the first work-class item, by measuring image rebuild time | High. Blocks the first sellable verified capability |
| 2 | gVisor installs and holds on the intended Proxmox host (OQ-08) | The isolation story needs a VM guest or Firecracker; the isolation milestone changes substantially | Early, and testable in a day | High, but cheap to discover — which is why the roadmap puts it first |
| 3b | **An agent can write a failing test that demonstrates a bug it suspects, often enough to be useful** | The advisory lane is mostly `unverified` findings, which is a comment generator with extra steps and extra cost | At the first advisory milestone, measured as the evidence ratio ([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)) | High. It is the entire differentiation of the advisory lane |
| 3c | **A worksite's slices are independently mergeable** | A campaign produces a conflict cascade and the remaining count does not fall, which the worksite progress oracle catches and cannot fix | At the first worksite, within a few cycles | Medium-high. The response is to re-declare the slice granularity, not to raise a ceiling |
| 3d | **"Merged with no human edit" is measurable correctly** across rebases, squashes and concurrent commits | The headline number and every kill criterion are computed from a wrong denominator, in our favour, which is the worst direction | At the first delivered pull requests, by hand-checking a sample against the computed figure | High, and it is the number the buyer decides on ([ADR-0028](../03-adr/0028-web-console-as-a-product-surface.md)) |
| 3 | ~~Verification commands can be produced per Task (OQ-07)~~ | **Largely retired** by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): a work class declares its oracle. **Partly revived by OQ-19** — if the chat front door is to serve arbitrary requests, generated planning and generated commands come back with it | When OQ-19 is answered | Low now, high if OQ-19 resolves toward generated planning |
| 4 | The progress oracle's precision is acceptable, at Run **and** worksite level | Either pass rate suffers or cost does; at worksite level, a campaign either thrashes or stops too early | With the eval suite for Runs; after several cycles for worksites | Medium. Expect to retune; the worksite-level one is the newest and least-tested bound in the system |
| 5 | Search/replace patches apply often enough | Cost per success balloons on a formatting problem, not a reasoning one | At the first agent loop | Medium. [ADR-0008](../03-adr/0008-search-replace-patch-format.md) sets a 20% threshold for reopening |
| 6 | Baked-in dependencies are workable in practice | A large share of real requests escalate for a package, and the product feels broken | Product-level, at a design partner | Medium-high. [ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md) names the reopening condition |
| 7 | Cost per successful outcome supports a price | No margin for support or a model price rise | At the evaluation milestone | High, and it is a kill criterion |
| 8 | A 1,500-token repo map suffices | Retrieval fails and attempts are wasted looking | At the deterministic-core and first-agent milestones | Low-medium. [ADR-0009](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md) names the trigger |
| 9 | Sandbox creation meets NFR-001 | Latency floor is worse than assumed; the number moves | At the isolation milestone, measured | Low. It is a provisional budget with a committed measurement |
| 10 | Purity discipline in routing survives contact with deadlines | Replay diverges and fixes stop being provable | Continuously, via the replay suite | Medium, and **rising**: schedules, queue ages, TTLs and worksite cycles are all new time-bearing mechanisms and each is a place to put a clock read in a predicate ([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) |
| 11 | **A Postgres queue table handles ingestion, redelivery and tenant fairness** | Backpressure and fairness get written in SQL under pressure by one person, and the broker decision reopens | Under real ingestion volume | Medium. [ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md) names a measured trigger |
| 12 | **A chat front door limited to declared work classes is useful to a non-developer** | The front door demos well and disappoints on first contact, and OQ-19 becomes urgent | At the first real requester, measured by recorded decline reasons | Medium-high. The decline reasons are the instrument, which is why they are recorded ([ADR-0025](../03-adr/0025-chat-front-door-request-broker.md)) |

Note the shape, and note that it degraded. Items 2, 2b, 2c, 5, 8 and 9 are discovered early and
cheaply, by design. Items 1, 1b, 1c, 1d, 6, 7 and 12 — the ones that decide whether the business
exists — are discovered late and only by contact with a customer or by accumulating enough human
judgements to be statistically meaningful. The advisory lane is structurally in the second group: it
ships on a weaker guarantee than the verified lane and the measurement that would justify it arrives
after the decision to build it. That asymmetry is not fixable by better specification, and item 1b is
still answerable this week by three conversations rather than by any amount of building.

## How to audit a generated specification, including this one

Practical heuristics, in the order that finds the most for the least reading. These apply equally to a
bundle M.A.D.E. produces for a customer.

**Read the negative consequences first.** In [the ADRs](../03-adr/README.md), the *Negative* sections
are where fabricated reasoning fails. A model that did not genuinely weigh a decision produces
plausible benefits and vague costs. Specific, uncomfortable, quantified costs are expensive to fake —
"a Sentry vulnerability is a host compromise", "an agent cannot add a dependency", "we cannot see
production" are the sentences that indicate the trade was actually made.

**Check the rejected alternatives are steelmanned.** An ADR that defeats a straw man is worse than
none, because it gives false confidence the question was examined. If the rejected option reads weakly,
the decision is unexamined.

**Check every number has a measurement method.** A requirement stating a threshold with no way to
measure it is decoration. Grep for a budget without a "Measured by".

**Check that open questions exist at all.** A specification with no open questions is either trivial or
dishonest. Any real system has decisions that cannot be made yet, and a generated bundle claiming
total certainty is the clearest available signal that it is confabulating.

**Run the contracts.** Schemas, API documents, DDL and diagrams are executable claims. If they do not
parse, apply and render, nothing else in the document deserves trust either.

**Spot-check one path end to end.** Pick a single requirement and follow it: does it appear in the
contract, in the schema, in the DDL, in a backlog item, and in a named test? One broken chain suggests
the rest are decorative.

## Why the blast radius here is smaller than in a customer's project

The failure mode is identical — a coherent wrong specification produces coherent wrong output, and the
errors compound instead of cancelling because every agent complies with the same mistake. Three things
differ, and only three:

**Nothing has been built yet.** Correcting a document costs a document. In a customer project the same
error has already become a codebase, a pipeline and possibly a release.

**The first work is strategy-independent.** The opening backlog items — scaffolding, schemas, the event
log, the lease, the guards, the sandbox provider — are correct almost regardless of whether the product
thesis is right. So the strategic assumptions get tested before much has been paid for them. That is
partly an accident of dependency ordering and partly deliberate. The 2026-09 vision change did not
invalidate any of them, which is the strongest available evidence that the foundational sequencing was
right: a vision change that rewrote the product boundary left the first milestone almost untouched.

**The reviewer is an expert in the constraints.** You know your hardware, your budget and your
customers; the specification does not. In a generated customer bundle the reviewer is frequently
reviewing a domain they are still learning, at the moment they know least about it — which is why
[ADR-0019](../03-adr/0019-specification-first-projects.md) confines normative authority to
machine-checked artefacts and requires a register of this kind to ship with any generated bundle.

To be explicit about the limit of that third point: **this specification has not yet had that expert
review.** Until it does, everything in category 2 above is one person's unexamined judgement, however
internally consistent.
