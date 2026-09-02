# Work classes

A **work class** is a named, recurring kind of job with a fixed task template, a declared **lane** and a
declared oracle. It is the reason the verified lane needs no Architect: the plan is not generated, it is
a property of the class ([FR-081](03-functional-requirements.md)). A model is invoked to *do* the work,
never to decide what the work is or whether it succeeded.

> **Extended by the 2026-09 vision change.** This document previously described one lane and treated
> `pr_review` as a cheap by-product that was "never the product". The advisory lane now ships in v1
> ([ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md)), so a class declares which lane it is
> in, and advisory classes are catalogued here as first-class rather than as a footnote. The rules for
> the two lanes are in [06-lanes.md](06-lanes.md); this document is the catalogue.

Every work class MUST declare its lane, and the lane is immutable for that class
([FR-147](03-functional-requirements.md)). The declaration is not a judgement call — it follows from one
question: **is there a command, declared before the work starts, whose exit code decides the outcome?**

**A verified class MUST declare an oracle**, and enabling it on a Project MUST fail if that oracle
cannot actually be executed there ([FR-085](03-functional-requirements.md)). A verified class without a
runnable oracle is not a class; it is a wish.

**An advisory class MUST declare its evidence forms** — what kinds of executable demonstration it will
attempt for the concerns it raises. A failing test, a benchmark, a reproduction script. An advisory
class that declares no evidence form at all is a comment generator, and it is not admissible
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)).

## The catalogue

**Oracle strength** is the property that matters most in the verified lane, so it is ranked explicitly.
*Strong* means the oracle pre-exists, the system did not write it, and it cannot be influenced by the
agent — the condition [ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md) is built
around. *Medium* means the oracle is real but partial, so a passing result is evidence rather than
proof.

### Verified lane

| Class | What the agent does | Oracle | Strength | Verdict |
| --- | --- | --- | --- | --- |
| **`dependency_upgrade`** | Bump a dependency and **fix the code the bump breaks** | The repository's existing test suite | **Strong** | **First. See below** |
| `lint_debt` | Enable a lint or type rule and fix every violation | Linter or type checker exits 0, plus the existing suite | Strong | Second, and the natural first worksite (OQ-11) |
| `api_migration` | Replace a deprecated API with its successor across call sites | Existing suite, plus the deprecation warning disappearing | Strong | Third |
| `language_conversion` | Convert a module from one language to another — the founder's JavaScript-to-TypeScript example | Existing suite passes, plus the type checker exits 0, plus the count of unconverted files falls | Strong, and **only viable as a worksite** — a whole codebase is not one Run | Candidate first worksite (OQ-11), and the hardest of the candidates |
| `dead_code` | Remove unreferenced symbols and files | Existing suite passes and coverage does not fall | Medium — dynamic dispatch and reflection defeat static reachability | Later, and conservatively |
| `test_gap` | Add tests for an uncovered branch | New test fails against the pre-change tree and passes after; coverage rises | Medium — proves the test runs and exercises the change, not that it tests the right thing | Later |
| `vuln_remediation` | Patch a flagged vulnerability by version or configuration | Scanner reports clean, plus the existing suite | Medium — depends on a third-party scanner's judgement | Later |

### Advisory lane

No entry here has an oracle. Each has **evidence forms** instead: the executable demonstrations it
attempts, so that a reader checks a finding rather than re-deriving it. Where no evidence is possible
the finding is labelled *unverified* ([FR-088](03-functional-requirements.md)), and the ratio is
measured per class ([FR-090](03-functional-requirements.md), NFR-030).

| Class | What the agent does | Evidence forms | Honest weakness |
| --- | --- | --- | --- |
| `pr_review` | Review a human's pull request and emit findings | A test that fails on the branch and passes on its base; a reproduction script; a benchmark showing a regression | The most valuable observations in a review — a misleading name, a missing case nobody wrote a test for, a design concern — have no executable form and will be `unverified` |
| `bug_hunt` | Examine a target for a known defect pattern and emit findings | A failing test or reproduction case per suspected defect | A demonstrated failure may be behaviour the maintainer deliberately does not support. Evidence raises checkability and does nothing for relevance |
| `todo_triage` | Classify outstanding TODO and FIXME markers by whether they are still true, and emit findings | For a TODO claiming a defect: a test that demonstrates it. For one claiming obsolescence: a search showing the referenced symbol is gone | Counting TODOs is trivially a command; **deciding which are worth acting on is not**, which is why this is advisory despite having a countable subject |
| `chat_triage` | Turn a requester's message into a brokered work-class invocation, or a decline with a reason | None — its output is a class selection or a decline, not a finding | The only advisory class whose output is not a finding, and the one most constrained by OQ-19 ([08-chat-front-door.md](08-chat-front-door.md)) |

Three assignments are worth defending because they get argued about.

**`test_gap` is verified, not advisory.** Its oracle is weak but real: the new test must fail against
the pre-change tree and pass after. That is an exit code, produced by a command declared in advance,
and it proves the test runs and exercises the change. It does not prove the test is a *good* test —
hence Medium.

**`todo_triage` is advisory, despite being countable.** A progress command can count untriaged markers
([07-worksites.md](07-worksites.md)), which makes it a legitimate advisory *worksite*. But the count is
not the work. Deciding which TODOs matter is a judgement, and a class that produced a "TODO resolved"
verdict from a model's opinion would be a false green.

**`language_conversion` is verified and cannot be a plain class.** Its oracle is strong, but a whole
codebase is not one Run and not one pull request. It exists only as a worksite, which is the clearest
illustration of why worksites had to be a first-class concept rather than a schedule.

### Why `dependency_upgrade` is first, and why it is not the easy one

It has the best oracle available anywhere in this system. The test suite already exists, the team
already trusts it, and no agent wrote it or can alter it. "The suite passed before and passes after" is
a complete definition of done that requires no judgement from anybody.

It is also where the free tools stop. Dependabot and Renovate open the pull request; when the upgrade
breaks the build, they leave a red pull request and a human fixes it. That human is expensive, senior,
and resents the job. **Starting where those tools stop is the product** — and it is why the first work
class is deliberately not the simplest one. A version bump alone is solved and free; the value is in
reading the failure, locating the call sites and changing the code, which is what the rest of this
architecture exists to do.

The honest cost: this is a multi-file change driven by a failure message, so it stresses retrieval
([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)) and the search/replace
patch format ([ADR-0008](../03-adr/0008-search-replace-patch-format.md)) harder than a single-file edit
does. Expect the first measured failures to cluster there.

A `dependency_upgrade` Run must additionally record the manifest change and the resolved versions, and
must reject a patch that edits a manifest without updating the lockfile consistently
([FR-083](03-functional-requirements.md)) — an inconsistent pair is how a green pull request installs a
different tree in production than it tested.

### How `pr_review` is shaped, and what changed about it

It has no oracle, so it cannot be verified and MUST NOT be reported as verified
([FR-086](03-functional-requirements.md)). What changed with the vision change is everything else.

> **A reversal worth seeing.** This document previously said `pr_review` "is cheap once everything else
> exists — but it is not the product, because it uses none of the machinery that is hard to copy: no
> sandbox, no budget ceiling, no termination guard, no audit trail". Under the review-by-evidence
> requirement that is **false in every clause**. Producing a failing test means writing a patch,
> applying it, and executing a command in a Sandbox — so it needs the sandbox, the budget ceiling, the
> attempt cap and the audit trail, and it inherits every isolation gate it was previously exempt from
> ([FR-091](03-functional-requirements.md), [FR-093](03-functional-requirements.md)). It is no longer
> cheap. The old claim that it "uses none of the machinery that is hard to copy" has inverted into the
> reason the evidence requirement is defensible at all: a comment-generating tool cannot produce
> evidence, because it has none of this.
>
> [FR-084](03-functional-requirements.md), which required the class to be read-only, is **withdrawn**
> for exactly this reason. [ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)'s
> rejection of a review bot as *the product* still stands — it is one lane of two, not the whole.

An advisory class writes only inside its own evidence workspace. It never patches or pushes the branch
under review, and never submits an approving review
([FR-091](03-functional-requirements.md), [ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

## Triggers

A Run is created by a person, a **schedule**, an **ingress event**, or a **worksite**
([FR-082](03-functional-requirements.md), [FR-116](03-functional-requirements.md),
[FR-099](03-functional-requirements.md)). The trigger never changes what a Run is.

The scheduler, the worksite driver and the ingress handlers are loops and routes inside the existing
processes, not new ones — the process-kind ceiling
([NFR-021](04-non-functional-requirements.md), reinterpreted by
[ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)) holds.

**Every trigger is subject to every existing bound without exception**: the concurrency caps at four
levels, the budget ceilings at four levels, and the attempt caps
([FR-119](03-functional-requirements.md)). This is the case those guards were built for, and the vision
change made it more so rather than less. A person submitting one Run at a time can absorb a cost
mistake. A schedule fanning out across two hundred repositories cannot. A worksite creating Runs across
weeks cannot. An ingress handler reacting to every pull request in a busy organisation cannot — and
unlike a schedule, its volume is set by somebody else's activity.

Because this work is unattended, three rules that are conveniences elsewhere become requirements here:

- Every Run still requires human approval before delivery
  ([FR-032](03-functional-requirements.md)). No trigger creates a merge.
- A Run that parks in `AWAIT_HUMAN` must be visible without anyone going looking, because nobody is
  watching a schedule or a worksite by definition.
- Waiting must be visible too. Queued work carries its position, age and reason
  ([FR-117](03-functional-requirements.md)), because with four trigger sources the answer to "why has
  nothing happened" is no longer obvious.

## Work classes and worksites

A worksite **invokes** a class; it does not replace one
([07-worksites.md](07-worksites.md), [ADR-0024](../03-adr/0024-worksites-as-long-running-campaigns.md)).
The relationship is worth stating precisely, because it is the join between two documents:

| | Work class | Worksite |
| --- | --- | --- |
| Declares | A task template, a lane, an oracle or evidence forms | An objective, a progress command, a scope, a slice rule, four ceilings, and the class to invoke |
| Produces | One Run's plan | Many Runs, one per slice |
| Bounded by | Attempt caps, Run ceiling, TTL | Spend, Run count, duration, open pull requests, and the campaign progress oracle |
| Succeeds when | A command exits zero | A measured count reaches its target, **on merged state** |

A class can be run standalone, on a schedule, or as a worksite's slice generator. `lint_debt` on one
module is a Run; `lint_debt` across a whole repository until the violation count reaches zero is a
worksite.

## How a work class maps onto the existing machinery

Nothing in the architecture changes. A work class supplies what the Architect would otherwise have
produced:

| Concept | Generated planning (deferred) | Work class (v1) |
| --- | --- | --- |
| `Spec` | Architect output on the `PLAN` tier | Implied by the class; no model call |
| `TaskGraph` | Architect output, validated by `GUARD_PLAN_VALID` | Instantiated from the class template |
| `verification_command` | Generated or from a Project template (OQ-07) | Declared by the class, in the verified lane |
| `touches` scope | Architect's judgement | Declared by the class — narrow and known in advance |
| Trigger | A person submitting a request | A person, a schedule, an ingress event, or a worksite |
| Lane | Always verified, by assumption | Declared explicitly and immutably ([FR-147](03-functional-requirements.md)) |

The `touches` entry is worth noticing: for maintenance work the affected paths are largely predictable,
so the enforced scope from [FR-080](03-functional-requirements.md) is tighter and more meaningful than
it could ever be for feature work. A `dependency_upgrade` that tries to edit a CI file or an unrelated
module is stopped by policy rather than caught in review.

## What is deliberately not a work class

**Feature development.** Out of scope; see
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).

**Anything with no runnable oracle, in the verified lane.** "Improve code quality", "make it faster",
"modernise this module". Each is a judgement call dressed as a task, and admitting one would
reintroduce the false-green failure the product is built to avoid.

**And in the advisory lane, the same requests are still refused as tasks.** This is the distinction the
vision change makes it easy to lose. The advisory lane does not admit "improve code quality" as work
to be done; it admits *findings about* code quality, each of which carries evidence or says it does
not. The difference is that nothing claims the objective was achieved
([06-lanes.md](06-lanes.md)). An advisory class whose output was "quality improved" would be the same
false green in a new costume.

**A class with no declared evidence form, in the advisory lane.** That is a comment generator, and it
is inadmissible for the same reason a verified class with no oracle is
([ADR-0023](../03-adr/0023-advisory-findings-carry-evidence.md)).

**A class that spans lanes.** A class that reviews *and* fixes is two classes. An advisory Run that
found something fixable emits a finding; it does not start a Run to fix it, because an agent that can
promote its own output across the lane boundary has erased the boundary.

**Multi-repository changes in one Run.** A Run operates on one repository. A campaign across several
is a worksite, which creates several Runs ([07-worksites.md](07-worksites.md)); batching them into one
Run would make failure attribution ambiguous, which is the same objection that keeps parallel Tasks
out.

**Anything requiring a new dependency to be installed at run time.** Dependencies are baked into the
pinned image ([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md)). A `dependency_upgrade`
is the interesting exception and it needs care: the upgrade itself changes the dependency set, so the
resolved tree must be produced at image build time or by an explicitly reviewed manifest change, never
by an agent reaching the network mid-Run.

> **Open question OQ-09** — How a `dependency_upgrade` Run obtains the new package version, given that
> Sandboxes have no network. Candidates: rebuild the pinned image per candidate upgrade before the Run
> and record both digests; or pre-populate a local package cache in the image for the candidate
> versions the scheduler intends to attempt. **Blocks:** `WORK-02`, the first sellable work class —
> this is now the most important unresolved question in the specification. **Resolved by:** measuring
> image rebuild time for a real repository against the [NFR-001](04-non-functional-requirements.md)
> Sandbox budget, and deciding whether a per-Run image build is affordable.
