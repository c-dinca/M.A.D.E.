# Work classes

The v1 product does one thing: it removes maintenance work from an engineering team's plate and returns
it as reviewable pull requests ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)).
This document defines the unit that work comes in.

A **work class** is a named, recurring kind of maintenance job with a fixed task template and a
declared oracle. It is the reason the first product needs no Architect: the plan is not generated, it
is a property of the class ([FR-081](03-functional-requirements.md)). A model is invoked to *do* the
work, never to decide what the work is or whether it succeeded.

Every work class MUST declare an oracle, and enabling a class on a Project MUST fail if that oracle
cannot actually be executed there ([FR-085](03-functional-requirements.md)). A class without a runnable
oracle is not a class; it is a wish.

## The catalogue

**Oracle strength** is the property that matters most, so it is ranked explicitly. *Strong* means the
oracle pre-exists, the system did not write it, and it cannot be influenced by the agent — the
condition [ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md) is built around. *Weak*
means the oracle is real but partial, so a passing result is evidence rather than proof.

| Class | What the agent does | Oracle | Strength | Verdict |
| --- | --- | --- | --- | --- |
| **`dependency_upgrade`** | Bump a dependency and **fix the code the bump breaks** | The repository's existing test suite | **Strong** | **First. See below** |
| `lint_debt` | Enable a lint or type rule and fix every violation | Linter or type checker exits 0, plus the existing suite | Strong | Second |
| `api_migration` | Replace a deprecated API with its successor across call sites | Existing suite, plus the deprecation warning disappearing | Strong | Third |
| `dead_code` | Remove unreferenced symbols and files | Existing suite passes and coverage does not fall | Medium — dynamic dispatch and reflection defeat static reachability | Later, and conservatively |
| `test_gap` | Add tests for an uncovered branch | New test fails against the pre-change tree and passes after; coverage rises | Medium — proves the test runs, not that it tests the right thing | Later |
| `vuln_remediation` | Patch a flagged vulnerability by version or configuration | Scanner reports clean, plus the existing suite | Medium — depends on a third-party scanner's judgement | Later |
| `pr_review` | Comment on a human's pull request | **None — advisory only** | N/A | Cheap once the platform exists; never the product |

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

### Why `pr_review` is shaped differently

It produces no patch and has no oracle, so it cannot be verified and MUST NOT be reported as verified.
It runs with a read-only toolbelt and its output is comments
([FR-084](03-functional-requirements.md)). That is a legitimate class, and it is cheap once everything
else exists — but it is not the product, because it uses none of the machinery that is hard to copy: no
sandbox, no budget ceiling, no termination guard, no audit trail. Reasoning in
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).

## Scheduling

Maintenance is recurring, so a Run may be created by a schedule as well as by a person
([FR-082](03-functional-requirements.md)): weekly dependency checks across a Project, a lint-debt sweep
per sprint. The scheduler is a loop inside the existing worker, not a new process — the four-process
ceiling ([NFR-021](04-non-functional-requirements.md)) holds.

Scheduled Runs are subject to every existing bound without exception: the concurrency cap, the Project
and deployment budget ceilings, and the attempt caps. This is the case those guards were built for. A
person submitting one Run at a time can absorb a cost mistake; a schedule fanning out across two
hundred repositories cannot, and an unbounded scheduler is the most direct route to the failure
[UF-2](../02-architecture/01-system-overview.md#the-five-unforgivable-failures) describes.

Because scheduled work is unattended, two rules that are conveniences elsewhere become requirements
here. Every Run still requires human approval before delivery
([FR-032](03-functional-requirements.md)) — a schedule creates pull requests, never merges. And a Run
that parks in `AWAIT_HUMAN` must be visible without anyone going looking, because nobody is watching a
schedule by definition.

## How a work class maps onto the existing machinery

Nothing in the architecture changes. A work class supplies what the Architect would otherwise have
produced:

| Concept | Generated planning (deferred) | Work class (v1) |
| --- | --- | --- |
| `Spec` | Architect output on the `PLAN` tier | Implied by the class; no model call |
| `TaskGraph` | Architect output, validated by `GUARD_PLAN_VALID` | Instantiated from the class template |
| `verification_command` | Generated or from a Project template (OQ-07) | Declared by the class |
| `touches` scope | Architect's judgement | Declared by the class — narrow and known in advance |
| Trigger | A person submitting a request | A person **or** a schedule |

The `touches` entry is worth noticing: for maintenance work the affected paths are largely predictable,
so the enforced scope from [FR-080](03-functional-requirements.md) is tighter and more meaningful than
it could ever be for feature work. A `dependency_upgrade` that tries to edit a CI file or an unrelated
module is stopped by policy rather than caught in review.

## What is deliberately not a work class

**Feature development.** Out of scope; see
[ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md).

**Anything with no runnable oracle.** "Improve code quality", "make it faster", "modernise this
module". Each is a judgement call dressed as a task, and admitting one would reintroduce the
false-green failure the product is built to avoid. If it cannot be checked by a command, it is not a
work class.

**Multi-repository changes in one Run.** A Run operates on one repository. Coordinated changes across
several are a v2 concern; batching them now would make failure attribution ambiguous.

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
