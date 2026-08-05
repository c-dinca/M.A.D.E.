# Agent playbook

How to pick up, execute and hand off one unit of work. Read [`/AGENTS.md`](../../AGENTS.md) first; this
document is the procedure, that one is the law.

## Picking up an item

1. **Choose.** Take the highest item in [02-backlog.md](02-backlog.md) whose **Blocked by** items are
   merged.
2. **Check for collisions.** List open branches and pull requests. If your item's **Touches** overlaps
   an in-flight item, stop and take another. Two agents editing one file is not a merge problem, it is
   two agents having been told different things
   ([04-engineering/05-git-and-review-workflow.md](../04-engineering/05-git-and-review-workflow.md)).
3. **Read exactly the Reading list.** Not more. The list is exhaustive; documents outside it are either
   irrelevant to this item or a sign the item is mis-scoped.
4. **Check for an open question.** If your item is marked blocked or constrained by an `OQ-##`, follow
   the constraint stated there. Do not resolve the question yourself.
5. **Branch** as `<item-id>-<short-slug>`.

## Executing

**Write the test first where the item has a hard gate.** Guards, the normaliser, the patch applier and
anything touching verification are all specified precisely enough that the test can be written from the
document. If you cannot write the test from the specification, the specification is unclear — report
that rather than guessing, because a guess becomes a permanent behaviour.

**Stay inside Touches.** If the work requires a path outside it, stop and report. Widening scope
silently is invisible to every other agent, since they read the backlog rather than your diff.

**Keep contract changes alone.** If you need a contract change, that is a separate item that lands
first ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).

**Run the gates as you go**: `make test`, `make spec-lint`, and `make escape` if you touched
`made/sandbox/`, `made/tools/` or configuration.

## Handing off

Open a pull request using the template in
[04-engineering/05-git-and-review-workflow.md](../04-engineering/05-git-and-review-workflow.md). State
the item id, what is now true, which requirements are implemented and which test proves each, and
whether the change affects any of the five unforgivable failures.

Then check your work against
[04-definition-of-done.md](04-definition-of-done.md) before requesting review, not after.

## When stuck

**Stop after two failed attempts at the same approach.** A third attempt at the same idea is how an
agent burns a day — and this is the same guard the product itself applies to its own agents
([ADR-0010](../03-adr/0010-termination-guards.md)), for the same reason.

Report:

1. What you tried, both attempts, concretely.
2. The evidence: the actual error, the failing assertion, the observed behaviour. Not your
   interpretation of it.
3. Your suspected root cause.
4. Two plausible next steps, with what each would cost.

**Never** weaken a test, loosen an assertion, add a tolerance, skip a case, raise a cap or a ceiling, or
silently drop part of the item. A blocked item reported honestly is worth more than a green pull
request that does less than it claims — which is precisely the failure this product exists to eliminate,
so producing it here would be self-defeating.

## The mistakes most likely to be made in this codebase, ranked

Ranked by damage multiplied by likelihood. Each names the consequence, because a rule whose reason is
understood is followed in the cases it did not anticipate.

**1. Putting IO or a clock read in a routing predicate or a guard.** It looks harmless — you need the
current time to check a TTL, or the attempt count from the database. The consequence is that replay
diverges from production, [NFR-016](../01-product/04-non-functional-requirements.md) fails, and every
future bug becomes unprovable because the historical stream no longer reproduces. Time enters as an
event; guards receive data, not repositories ([ADR-0002](../03-adr/0002-langgraph-as-executor-with-pure-routing.md)).

**2. Making verification more forgiving to get a Run to pass.** Retrying on a non-zero exit, treating a
timeout as a pass, letting the Reviewer mark success, allowing an agent to adjust the command. Every one
of these is a direct attack on [UF-3](../02-architecture/01-system-overview.md#the-five-unforgivable-failures),
which is the product's central claim. It will be tempting because a failing Run looks like your bug
([ADR-0014](../03-adr/0014-verification-oracle-is-authoritative.md)).

**3. Adding a fallback when the isolation runtime is unavailable.** Any code that continues with the
default runtime makes the product's claim false while every test still passes. The system must refuse
([FR-055](../01-product/03-functional-requirements.md)).

**4. Fuzzy-matching a patch so it applies.** Raises the pass rate immediately and corrupts files
silently, sometimes in ways that still pass verification
([ADR-0008](../03-adr/0008-search-replace-patch-format.md)).

**5. Building a prompt string at a call site.** Bypasses the token budget and the cache prefix ordering.
The cost regression is invisible in behaviour and appears only in the cached-token ratio
([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)).

**6. Writing an effect without its event, or outside its transaction.** Creates a silent audit gap that
surfaces in the nightly reconciliation long after the change, when nobody remembers it
([NFR-015](../01-product/04-non-functional-requirements.md)).

**7. Putting something variable in the stable prompt prefix.** A timestamp, a run id, an unsorted set.
One byte destroys the cache for the whole call, and nothing behaves differently
([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)).

**8. Reimplementing failure normalisation.** A second normaliser makes the progress oracle compare
something different from what the agent was shown, so retries stop being refused correctly. There is
exactly one implementation ([ADR-0010](../03-adr/0010-termination-guards.md)).

**9. Reading current State from the latest event instead of `run_cursor`.** Works most of the time, then
returns a wrong answer whenever the last event did not change state
([02-data-model.md](../02-architecture/02-data-model.md)).

**10. Raising a cap or a ceiling to make something finish.** Removes the bound UF-2 depends on. Caps are
Project configuration, versioned and recorded — never a code change.

**11. Storing file contents in graph state.** Serialises the codebase into every checkpoint and leaks it
into prompts ([ADR-0007](../03-adr/0007-git-worktree-as-project-state.md)).

**12. Using a banned synonym.** `job`, `container`, `test run`, `iteration`. Vocabulary drift makes the
log, the schema and the API describe the same thing differently, and an agent debugging later builds a
wrong model ([00-context/03-glossary.md](../00-context/03-glossary.md#banned-synonyms)).

**13. Implementing something from the "do not build" lists.** Parallel Task execution, a tenant column,
a vector index, webhooks, cross-Run memory. Each is specified as a seam precisely so that building it is
a visible mistake rather than a plausible improvement
([15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)).

**14. Adding a fifth long-running process.** Breaks [NFR-021](../01-product/04-non-functional-requirements.md)
and the one-operator principle. A contract test catches it, but the design work is already wasted by
then.

## Reference: where things are decided

| Question | Answer lives in |
| --- | --- |
| What does this word mean, and can I use that synonym? | [00-context/03-glossary.md](../00-context/03-glossary.md) |
| What must this endpoint accept and return? | [`/contracts/openapi.yaml`](../../contracts/openapi.yaml) |
| What states and transitions exist? | [`/contracts/state-machine.json`](../../contracts/state-machine.json) |
| What columns and constraints exist? | [`/contracts/db/0001_init.sql`](../../contracts/db/0001_init.sql) |
| Why is this rule here? | The ADR it cites |
| Is this in scope? | [01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md), then the seams document |
| What counts as finished? | [04-definition-of-done.md](04-definition-of-done.md) |
