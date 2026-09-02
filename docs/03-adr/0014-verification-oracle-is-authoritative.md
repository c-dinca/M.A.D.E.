# ADR-0014 — The verification exit code is the sole definition of Task success

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-3, FR-033, FR-034, FR-042, NFR-018, [02-architecture.md](../02-architecture.md)

## Context

Something must decide whether a Task succeeded. The candidates are: an agent's own assessment, a
reviewing agent's verdict, a heuristic over the diff, or the exit code of an executed command.

The intake identifies the failure precisely — incumbent systems push a wrong solution forward instead
of stopping — and the whole product position depends on not reproducing it
([UF-3](../02-architecture.md)). A single false
green is worse than a low success rate, because after it every output must be audited from scratch,
which is more work than writing the change by hand.

## Decision

A Task is successful when its declared `verification_command`, executed unmodified in a Sandbox, exits
zero. Nothing else makes a Task successful.

The supporting rules, each closing a specific route around it:

- The command is declared at plan acceptance and is immutable thereafter
  ([FR-034](../03-requirements.md)); the schema has no update path.
- `GUARD_PLAN_VALID` rejects any plan containing a Task without a command, so unverifiable work never
  enters the queue.
- The `VERIFY` State has no agent and a toolbelt containing only `run_verification`, which takes no
  arguments.
- The Reviewer is **advisory**: it may send work back or escalate, and cannot mark success
  ([FR-042](../03-requirements.md)).
- For Tasks of kind `test`, the oracle runs twice — the new test must fail against the pre-change tree
  and pass against the post-change tree — because a test that passes before the change proves nothing.
- INV-2 asserts as a database invariant that no Run reaches `DONE` without a zero exit code per Task
  ([NFR-018](../03-requirements.md)).
- Reporting uses three words: *verified*, *failed verification*, *not verified*
  ([FR-045](../03-requirements.md)).

## Alternatives considered

### LLM-as-judge as the success criterion — rejected

The strong case: a judge model catches what an exit code cannot. A change can pass its test while
being wrong in ways that matter — deleting an unrelated branch, hard-coding a value that should be a
parameter, logging a secret. Tests are incomplete on every real codebase, so exit-code-only success
accepts changes a competent reviewer would reject, and a judge raises the effective quality bar. It
also works on repositories with weak test coverage, which is most of them.

It lost because an LLM judging an LLM produces correlated errors: the judge shares the generator's
misunderstanding of the requirement, and the failure mode is precisely a confident false green. It
also makes the correctness guarantee depend on model quality, which is rented and moves — so the one
property that does not degrade when the model does would start degrading. The value it offers is
real, which is why the Reviewer role exists at all; it is captured as advisory findings attached to
the branch for the human, where a judgement call belongs.

### Heuristics over the diff (coverage delta, complexity, "does it look right") — rejected

The case: cheap, deterministic, no model call, and catches obvious classes of bad change such as a
patch that deletes far more than it adds.

Rejected as a *success* criterion because none of these measures whether the code does what was asked.
They are useful as pre-filters — which is what the lint and syntax gate is
([FR-037](../03-requirements.md)) — and dangerous as arbiters, because they can
be satisfied by a change that does nothing.

### Human review as the success criterion — rejected

The case: the most reliable judge available, and a human already approves delivery, so make that the
definition.

Rejected because it moves the entire verification burden onto the person the product is meant to
relieve, and because it makes the retry loop unusable — the progress oracle needs a signal available
in seconds, not hours. Human approval remains mandatory for *delivery*
([ADR-0011](0011-durable-human-approval-gates.md)); it is a gate on shipping, not a definition of
correctness.

## Consequences

### Positive

The correctness guarantee is independent of model quality and does not degrade when a provider changes
a model underneath us. It is checkable as a database invariant, so it can be asserted nightly rather
than trusted. It gives the progress oracle a fast, objective signal. And it is the one claim the
product can make that competitors relying on model self-assessment cannot.

### Negative

**The system is only as good as the target repository's tests**, which is why repositories without
them are refused at registration ([FR-004](../03-requirements.md)) — a genuine
market restriction, and it excludes exactly the customers who might benefit most. A change that passes
a weak test is accepted even when it is poor, so the system inherits the customer's test quality as
its own quality ceiling. Writing a good `verification_command` per Task is hard, and the Architect may
produce a bad one — which is the subject of OQ-07 and the reason a Project-declared template is the
required path in v1. Double execution for `test` Tasks doubles Sandbox cost for that kind. And a
correct change whose test is flaky is reported as failed, so flakiness in the customer's suite becomes
our visible failure rate.

## Revisit when

Never for the direction of authority — an advisory signal must never become authoritative. The open
sub-question is whether the Reviewer's findings should be able to *block* delivery (as opposed to
marking success), which is a different and more defensible power. Reopen that when evaluation shows
Reviewer findings correlating with changes a human subsequently rejects.
