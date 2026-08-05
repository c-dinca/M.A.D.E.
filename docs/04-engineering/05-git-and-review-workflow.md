# Git and review workflow

Written for several agents working at once. The collision-avoidance rules are the load-bearing part:
two agents editing the same file is not a merge conflict problem, it is a *specification* problem —
they were each told a different thing was true, and one of them will win silently.

## Branching

One branch per backlog item, named `<item-id>-<short-slug>` in lowercase, for example
`ORCH-04-progress-oracle`. The item id in the branch name is what lets another agent see, from the
branch list alone, which items are in flight and therefore which paths are claimed.

Trunk is `main` and is always releasable. No long-lived integration branches: they defeat the point of
landing contract changes first, because a contract change sitting on a branch is invisible to everyone
else.

## Collision avoidance

Every backlog item declares **Touches** — the paths it may modify
([05-delivery/02-backlog.md](../05-delivery/02-backlog.md)). The protocol:

1. **Before starting**, list open branches and open pull requests, and read the **Touches** of every
   in-flight item.
2. **If your Touches overlap another in-flight item, stop.** Do not start. Report the overlap and the
   item id you collided with. Working anyway produces a conflict resolved by whoever merges second,
   who has no idea what the first change intended.
3. **If your work requires touching a path outside your declared Touches, stop.** The item is wrong —
   either the scope was mis-specified or you have found a hidden dependency. Report it; do not widen
   silently. A widened scope is invisible to every other agent, because they read the backlog, not
   your diff.
4. **Contract changes land alone and first.** A pull request that modifies anything under
   [`/contracts/`](../../contracts/) contains *only* that change plus its schema tests. Consumers
   follow as separate items ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).

Rule 4 is what allows parallelism. When the contract lands first, three agents can implement three
consumers of it simultaneously without reading each other's code, because they all read the same
normative file.

## Commits

Conventional-commit prefix, imperative mood, item id in the footer:

```
feat(orchestrator): refuse retry when failure signature repeats

Implements GUARD_PROGRESS per ADR-0010. A retry is permitted only when the
patch hash is new and either the failure signature changed or the failing
count decreased.

Refs: ORCH-04, FR-040, NFR-012
```

The `Refs:` footer is not decoration: it is how a reviewer, and later an auditor of our own process,
traces a line of code to the requirement that justified it. Every commit that implements a requirement
names it.

Commits are logical units. A formatting sweep is its own commit, never mixed with behaviour, because a
reviewer cannot see behaviour inside a thousand-line reformat.

## Pull requests

### Template

```markdown
## Item
<backlog item id and one-line description>

## What changed
<two to five sentences. What is now true that was not.>

## Requirements
Implements: FR-###, NFR-###
Tests: <the test that proves each>

## Touches
<paths modified — must match the item's declared Touches>

## Contract impact
None | Modifies /contracts/... (this PR contains only the contract change)

## Risk profile
Affects: UF-1 | UF-2 | UF-3 | UF-4 | UF-5 | none
<if any, what mechanism was verified and how>

## Verification
- [ ] `make test` passes
- [ ] `make spec-lint` passes
- [ ] `make test-int` passes (or: not applicable, and why)
- [ ] `make escape` passes (required if sandbox, tools or config touched)
- [ ] `make eval-compare` shows no regression (required if prompts, tiers or retrieval touched)

## Open questions encountered
<OQ ids hit, or none>
```

### Review checklist

**Blocking.** Any one of these fails the review outright.

- [ ] A test proves each claimed requirement, and it fails without the change.
- [ ] No routing predicate or guard performs IO, reads the clock, or uses randomness.
- [ ] No effect that spends money or executes code is written outside its event's transaction.
- [ ] Nothing weakens a verification path: no model output can influence a verification result, and no
      `verification_command` becomes mutable ([ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md)).
- [ ] No new capability, credential, mount or network path in a Sandbox.
- [ ] No fallback to a weaker sandbox runtime, anywhere, under any condition.
- [ ] No secret, customer data or generated artifact added to the repository.
- [ ] Contract changes are alone in this pull request.
- [ ] Touches match the declared item scope.
- [ ] No banned synonym in an identifier, column or API field
      ([00-context/03-glossary.md](../00-context/03-glossary.md#banned-synonyms)).
- [ ] A cap, ceiling or timeout was not raised to make something pass.
- [ ] No test was weakened, skipped or given a tolerance to make it pass.

**Non-blocking but requiring a response.** Naming, comment density, structure, test placement,
opportunities to delete code.

The blocking list is short and every entry maps to an unforgivable failure or to a decision an ADR
already settled. That is deliberate: a checklist long enough to skim is a checklist that gets skimmed.

## Merging

Squash merge, so `main` has one commit per item and the commit message carries the item id and the
requirement references. Delete the branch on merge, which is also how the collision protocol learns
that paths are free again.

Required checks before merge: `spec-lint`, `test`, `contract`, `replay`, `escape` (fast subset),
`test-int`, `types`, `lint`, and the secret scan. Details in [06-ci-cd.md](06-ci-cd.md).

## Changing a decision

Do not argue with an accepted ADR in a pull request description. Write a superseding ADR
([03-adr/README.md](../03-adr/README.md)), get it accepted, then implement against it. This is slower
on purpose: it is what stops a settled question from being re-litigated in a review comment thread
that nobody will find in six months.

## When work is blocked

Stop after two failed attempts at the same approach
([`/AGENTS.md`](../../AGENTS.md)). Report: what was tried, the evidence, the suspected root cause, and
two plausible next steps. Do not weaken a test, do not widen scope, do not silently drop part of the
item. A blocked item reported honestly is worth more than a green pull request that quietly does less
than it claims — which is, precisely, the failure mode the product itself exists to eliminate.
