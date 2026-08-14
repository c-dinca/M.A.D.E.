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
| Every internal link and heading anchor resolves | 895 links checked |
| Every diagram renders | 6 Mermaid diagrams compiled |
| Every requirement has an identifier and a named test method | 80 FRs, 28 NFRs, all referenced somewhere outside their own definition |
| Every backlog item declares Reading, Touches, Role, acceptance criteria and dependencies | 56 items checked |
| Every ADR records a rejected alternative and negative consequences | 19 checked |

**2. Internally consistent but externally unproven.** The largest category, and the one to be careful
about. The architecture does not contradict itself. Whether it *works* is untested — no line of the
system has ever run.

**3. Assumed, and marked.** Numbers chosen by judgement rather than measurement are labelled
**provisional** in [the NFR document](../01-product/04-non-functional-requirements.md). They are
enforced as gates anyway, because a gate that is occasionally re-tuned catches regressions while a
gate deferred until the number is certain never arrives.

**4. Unknown, and declined.** Eight [open questions](../05-delivery/02-backlog.md#open-questions)
mark places where the specification refuses to assert. An agent hitting one must stop rather than
invent an answer.

## What internal consistency does not buy

Consistency detects **contradiction**, not **error**. A specification can be flawlessly coherent and
completely wrong, and the checks above would pass unchanged. Specifically, nothing here proves:

- that the isolation runtime installs and holds on the platform this will actually run on (OQ-08);
- that the progress oracle refuses the right retries rather than too many or too few;
- that a 1,500-token repository map is enough context to locate a change in a real codebase;
- that an agent can produce a search/replace patch that applies often enough for the cost model to
  work;
- that cost per successful outcome lands anywhere near a price a buyer would pay;
- that anybody wants this product.

The last one is the largest risk in the document and **no engineering milestone tests it.** Only a
customer does.

## The load-bearing unproven claims, ranked

Ranked by damage multiplied by likelihood, with the point at which each becomes known. This is the
list to argue with.

Updated by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): the product is
now maintenance work on existing repositories, which **removes** the old third-ranked risk (whether a
verification command can be generated per Task — the oracle is now the repository's existing suite) and
**adds** a new second-ranked one (OQ-09).

| # | Claim | If false | Known at | Cost of being wrong |
| --- | --- | --- | --- | --- |
| 1 | Someone will pay to have maintenance work done unattended, rather than continuing to do it with people or accepting the debt | The strategy is wrong, not the architecture | Only at a design-partner conversation | Total. Nothing else matters |
| 1b | Buyers distinguish "unattended, budgeted, audited" from "we already have Cursor" | The positioning collapses into a comparison we lose on capability and price | First three sales conversations | Total, and it is the question to ask before writing more code |
| 2b | A dependency upgrade can obtain its new version without giving the Sandbox network access (OQ-09) | Either the no-network decision or the first work class has to change | Before WORK-02, by measuring image rebuild time | High. Blocks the first sellable capability |
| 2 | gVisor installs and holds on the intended Proxmox host (OQ-08) | The isolation story needs a VM guest or Firecracker; M1 changes substantially | M1, and testable in a day | High, but cheap to discover — which is why the roadmap puts it first |
| 3 | ~~Verification commands can be produced per Task (OQ-07)~~ | **Largely retired** by [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md): a work class declares its oracle, and for maintenance work it is the repository's existing suite. Returns only with generated planning at M4 | M4, if ever | Low now, high then |
| 4 | The progress oracle's precision is acceptable | Either pass rate suffers or cost does | M5, only with the eval suite | Medium. Expect to retune; the ADR names this |
| 5 | Search/replace patches apply often enough | Cost per success balloons on a formatting problem, not a reasoning one | M3 | Medium. [ADR-0008](../03-adr/0008-search-replace-patch-format.md) sets a 20% threshold for reopening |
| 6 | Baked-in dependencies are workable in practice | A large share of real requests escalate for a package, and the product feels broken | M6, product-level | Medium-high. [ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md) names the reopening condition |
| 7 | Cost per successful outcome supports a price | No margin for support or a model price rise | M5 | High, and it is a kill criterion |
| 8 | A 1,500-token repo map suffices | Retrieval fails and attempts are wasted looking | M2–M3 | Low-medium. [ADR-0009](../03-adr/0009-tool-mediated-retrieval-no-vector-db.md) names the trigger |
| 9 | Sandbox creation meets NFR-001 | Latency floor is worse than assumed; the number moves | M1, measured | Low. It is a provisional budget with a committed measurement |
| 10 | Purity discipline in routing survives contact with deadlines | Replay diverges and fixes stop being provable | Continuously, via the replay suite | Medium. Enforced by lint rather than trusted |

Note the shape: items 2, 2b, 5, 8 and 9 are discovered early and cheaply, by design. Items 1, 1b, 6 and
7 — the ones that decide whether the business exists — are discovered late and only by contact with a
customer. That asymmetry is not fixable by better specification, and item 1b is answerable this week by
three conversations rather than by any amount of building.

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

**The first work is strategy-independent.** The opening fifteen backlog items — scaffolding, schemas,
the event log, the lease, the guards, the sandbox provider — are correct almost regardless of whether
the product thesis is right. So the strategic assumptions get tested before much has been paid for
them. That is partly an accident of dependency ordering and partly deliberate.

**The reviewer is an expert in the constraints.** You know your hardware, your budget and your
customers; the specification does not. In a generated customer bundle the reviewer is frequently
reviewing a domain they are still learning, at the moment they know least about it — which is why
[ADR-0019](../03-adr/0019-specification-first-projects.md) confines normative authority to
machine-checked artefacts and requires a register of this kind to ship with any generated bundle.

To be explicit about the limit of that third point: **this specification has not yet had that expert
review.** Until it does, everything in category 2 above is one person's unexamined judgement, however
internally consistent.
