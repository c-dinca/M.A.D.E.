# The agent role model

The previous specification named five roles in a table and left it there
([00-context/03-glossary.md](../00-context/03-glossary.md#agent-roles)). That was adequate while the set
was fixed. The new vision has roles "specialised by role: architecture, deterministic execution,
testing, development, review, and others to be defined", so the set has to be able to grow — and a set
that can grow needs a definition of what a role *is*, or it grows into a swarm of prompt variants
nobody can reason about.

Which roles the founder actually wants is **OQ-16**. This document specifies the model, not the list.

## What a role is

A role is defined by exactly **five** things. Nothing else is part of a role, and a role that needs a
sixth is a design change rather than a configuration.

| # | Property | Where it is declared |
| --- | --- | --- |
| 1 | The **lane** it acts in, and the States within it | [`/contracts/state-machine.json`](../../contracts/state-machine.json) |
| 2 | Its **tool authority** — read-only set, plus any write or execute tool | The State's declared authority in the contract, read by the toolbelt factory ([FR-069](../01-product/03-functional-requirements.md)) |
| 3 | Its **capability tier** | Project configuration ([10-llm-integration-and-evaluation.md](10-llm-integration-and-evaluation.md)) |
| 4 | The **artifact kinds** it may produce | [`/contracts/schemas/`](../../contracts/schemas/) |
| 5 | Its **prohibitions**, stated explicitly | This document, and a test per prohibition |

A role is **not** a service, not a process, not a persistent identity and not a container. Roles are
prompts plus tool grants plus a tier. A microservice per role was considered and rejected because roles
are not workloads with different scaling characteristics
([01-system-overview.md](01-system-overview.md#rejected-architectures)), and a resident per-role process
was rejected because an agent holding state that is in no event log makes a Run unexplainable
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

An agent instance is constructed on entering a State, receives artifacts, produces an artifact, and is
discarded ([FR-115](../01-product/03-functional-requirements.md)).

## The two actors that are not roles

Naming these prevents a specific mistake, and one of them is a mistake the founder's phrasing invites.

**The Executor.** The founder's list includes "deterministic execution" alongside the model-driven
roles. In this architecture that actor exists and is **code**: it executes a Task's declared
`verification_command`, and an advisory Run's evidence commands, with no model in the loop. Calling it
a role would imply a prompt and a model where the entire point is that there is neither — the absence
of a model in `VERIFY` is load-bearing
([06-verification-and-truthfulness.md](06-verification-and-truthfulness.md)). It has no tier, no
toolbelt beyond `run_verification`, and no artifact it authors by judgement.

**The Broker.** Request triage sits at the boundary and it *is* model-driven, so it is a role
(**Triager**, below). But the *entitlement check* that gates it is code, it runs before the model does,
and no model output can widen it ([FR-107](../01-product/03-functional-requirements.md)). The
authorisation decision is not part of any role.

## The roles

The set as it stands. It is **not** settled — OQ-16 — and it is deliberately short, for the reason in
the next section.

| Role | Lane | States | Tool authority | Tier | Produces | MUST NOT |
| --- | --- | --- | --- | --- | --- | --- |
| **Architect** | verified | `SPEC`, `PLAN` | Read-only set | `PLAN` | `Spec`, `TaskGraph` | Implement; choose a verification command after seeing a failure. **Deferred** ([ADR-0020](../03-adr/0020-technical-debt-remediation-as-the-v1-product.md)); returns only if OQ-19 says so |
| **Developer** | verified | `IMPLEMENT` for `task.kind = code` | Read-only set plus `apply_patch` | `EDIT` | `Patch` | Modify a verification command; write outside the Task's `touches` scope; run a verification itself |
| **QA** | verified | `IMPLEMENT` for `task.kind = test` | Read-only set plus `apply_patch` | `EDIT` | `Patch` containing tests | Produce a test that passes against the pre-change tree — the double-execution rule is what makes this role distinguishable from a green-tick generator |
| **DevOps** | verified | `IMPLEMENT` for `task.kind = iac` | Read-only set plus `apply_patch` | `EDIT` | `Patch` containing deployment artifacts | Build or run a model-authored image ([04-execution-isolation.md](04-execution-isolation.md)) |
| **Reviewer** | both | `REVIEW` (verified), `ASSESS` (advisory) | Read-only set plus the diff; in `ASSESS`, plus `apply_patch` and `run_verification` **scoped to the evidence workspace** | `CRITIC` | `ReviewReport`; `Finding` with an `evidence_state` | Mark a Task successful; patch or push the reviewed branch; submit an approving review; emit a finding with neither evidence nor an `unverified` label |
| **Triager** | advisory | Request triage and clarification | Read-only set over the entitled classes' parameter schemas. **No repository access** | `NAV` | A brokered class invocation, or a decline with a reason | Create a Run outside the requester's entitlement; infer a missing parameter; exceed the clarification allowance; produce a plan |

Two entries deserve a note.

**The Reviewer is the only role that spans lanes**, and its authority differs between them, which is
the sharpest illustration of why authority is a property of the State rather than of the role. In
`REVIEW` it cannot write at all. In `ASSESS` it can write and execute — but only inside the evidence
workspace, and the constraint is enforced by the toolbelt the State hands it, not by instruction
([FR-091](../01-product/03-functional-requirements.md)).

**The Triager has no repository access at all.** It sees the parameter schemas of the classes the
requester is entitled to invoke, and the requester's message. It does not read the target repository,
which means a crafted chat message cannot use triage as a repository-reading oracle.

## How roles hand off

**Only through artifacts, only through the orchestrator.** There is no channel for the Developer to ask
the Architect a question, and adding one is forbidden
([05-orchestration-and-termination.md](05-orchestration-and-termination.md)): a direct channel is
unbounded in tokens and turns, and unauditable.

```
Architect ──Spec, TaskGraph──► [orchestrator] ──Task──► Developer ──Patch──► [orchestrator]
                                                                                    │
                                              Executor (code, no model) ◄──argv─────┘
                                                        │
                                        TestReport ─────┴──► [orchestrator] ──► Reviewer ──ReviewReport──►
```

Three properties of every handoff, and each is a rule rather than a description:

**The artifact is schema-validated and content-addressed.** A role receives a digest and a validated
object, never a transcript ([FR-074](../01-product/03-functional-requirements.md)).

**The orchestrator decides what happens next.** No role routes. A role's verdict is an input to a pure
predicate, and the Reviewer's is explicitly advisory
([FR-042](../01-product/03-functional-requirements.md)).

**Nothing crosses a lane boundary as work.** A Finding from `ASSESS` does not become a Task. An advisory
role that discovers something fixable emits a finding with evidence; a human, or a declared class a
human triggered, does the fixing ([06-lanes.md](../01-product/06-lanes.md)). A role that can promote
its own output across the lane boundary has erased the boundary.

## How a new role is added

A checklist, because the failure mode is a role added by copying a prompt file.

1. **Show it is not an existing role in a hat.** A candidate that shares its lane, States, tool
   authority, tier and artifact kinds with an existing role is a **prompt variant**, not a role. Add a
   prompt, not a role. This is the check that stops role inflation, and it is the one most likely to be
   skipped.
2. **Declare the five properties.** All of them, in the places named in the table above.
3. **Add its tool authority to the contract.** [`/contracts/state-machine.json`](../../contracts/state-machine.json)
   is normative and the toolbelt factory reads it. A role whose authority exists only in code has an
   authority nobody can audit — and a contract change lands alone and first
   ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)).
4. **State its prohibitions and write a test for each.** "MUST NOT" with no test is a comment.
5. **Add its artifact schema** if it produces a new kind, and give it `schema_version`.
6. **Add golden cases**, including at least one adversarial case asserting no tool call outside its
   authority ([FR-078](../01-product/03-functional-requirements.md)).
7. **Write an ADR if it introduces a new State, a new artifact kind, a new lane, or a tool no existing
   role has.** Otherwise it is a backlog item.

### What forces an ADR rather than a backlog item

| Change | Needs |
| --- | --- |
| A prompt variant of an existing role | Nothing beyond review and an eval comparison |
| A new role reusing existing States, tools and artifact kinds | A backlog item and a contract change for its authority |
| A new State, or a new artifact kind | An ADR — it changes the state machine or the artifact contract |
| A new **tool** | An ADR — tools are authority, and the toolbelt is the injection boundary ([06-verification-and-truthfulness.md](06-verification-and-truthfulness.md)) |
| A role that writes where none did | An ADR, and an escape-suite case |
| A role in a new lane | An ADR superseding [ADR-0022](../03-adr/0022-two-lanes-verified-and-advisory.md) |

## Why the set is deliberately short

The word "swarm" invites many roles, and many roles is the failure mode rather than the goal. Each role
costs a prompt to maintain, a tier assignment to tune, golden cases to keep passing, an adversarial
case, an entry in the toolbelt authority table, and a permanent obligation to explain how it differs
from its neighbours. Six roles that are genuinely distinct are more capable than sixteen that overlap,
because overlapping roles produce inconsistent output for the same input and nobody can attribute a
regression.

The specialisation that matters in this architecture is **authority**, not personality. A "Security
Reviewer" role that reads the same files with the same tools at the same tier as the Reviewer, differing
only in what its prompt tells it to look for, is a prompt. A role that can execute something the
Reviewer cannot is a role.

> **Open question OQ-16** — The role list the founder actually wants. The list above is derived from
> what the architecture needs, and the founder's phrasing — "architecture, deterministic execution,
> testing, development, review, and others to be defined" — maps onto it with two mismatches worth
> resolving: **deterministic execution** is the Executor and is code rather than a role, and
> **architecture** is the Architect, which is currently deferred (OQ-19). **Blocks:** the prompt
> directory layout, the tool-authority table in the state-machine contract, and the golden-suite case
> set. Does **not** block anything if the answer is "the list above", which is why this document
> specifies the model rather than waiting. **Resolved by:** the founder naming the roles, and for each
> one, what it may do that no existing role may.
