# Problem and vision

## The gap

Two categories of AI development tooling exist, and neither serves an engineering organisation that
has production systems and a security function.

Autonomous cloud agents accept a ticket and return a pull request, but they are opaque, they are
billed per unit of autonomous compute so a reasoning error becomes a bill, and — per the assessment
carried in the project intake — they push a wrong solution forward instead of stopping to ask when
they are stuck. Browser-based prototyping platforms turn a prompt into a running web application in
seconds, but they produce an isolated artifact with no deployment pipeline, no container topology and
no path into a real production estate. Open-source agent frameworks solve the orchestration problem
and leave the execution problem: they run model-generated code in whatever sandbox the operator
happens to have, which in practice is a shared-kernel container.

The organisations most able to pay are the ones least able to adopt any of these. A company with an
internal security review will not grant an opaque cloud agent write access to its source, because it
cannot answer three questions: what exactly did the agent execute, where could the source have gone,
and what stops a run from consuming an unbounded budget.

## What M.A.D.E. is

A self-hosted, security-hardened system in which specialised agents — Architect, Developer, QA,
Reviewer and DevOps — collaborate under a deterministic state machine to change an existing
repository, and prove the change with an executable oracle before a human is asked to approve it.

Three properties define it, and each is a direct answer to one of the failures above:

**Execution is isolated by an enforced boundary, not by policy.** Model-generated code runs under a
kernel that is not the host kernel, with no network and no credentials. The isolation claim is
carried by an escape test suite that gates every deploy, not by an assurance in a sales deck. See
[02-architecture/04-execution-isolation.md](../02-architecture/04-execution-isolation.md).

**Termination is a system property, not a hope.** Agents produce typed artifacts; a deterministic
routing layer decides what happens next. Attempt caps, a progress oracle, cycle detection and a
pre-flight budget check make an unbounded run structurally impossible rather than unlikely. See
[02-architecture/05-orchestration-and-termination.md](../02-architecture/05-orchestration-and-termination.md).

**Success is defined by an exit code.** No task enters the graph without a machine-checkable
verification command, and no model opinion can override the result of running it. See
[02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md).

The delivered unit of value is not a code snippet. It is a branch containing the change, the tests
that prove it, the deployment artifacts that ship it, and an audit log of every command executed and
every token spent producing it.

## Why now

Three conditions hold simultaneously, and the specification depends on all three:

Open-weight coding models are now strong enough to run the high-volume iterative work locally, which
is what makes an air-gapped deployment a real product rather than a degraded one. Hardware-level and
kernel-level sandboxing (KVM microVMs, user-space kernels) is packaged well enough that a single
engineer can deploy it, which is what makes the security claim affordable. And the failure modes of
the first generation of autonomous agents are now documented in the open, which means a buyer
understands what they are protecting against and will pay for the protection.

## What winning looks like

Winning in v1 is narrow and measurable: an engineering team runs M.A.D.E. on their own hardware
against their own private repository, accepts pull requests from it without a security exception, and
can answer their auditor's questions from the run log without contacting us.

The counterfactual matters more than the demo. A run that stops and says "I could not make the test
pass; here are the three attempts and what each failed on, at a cost of $0.14" is a success of this
system. A run that produces a plausible diff and claims it works is a failure even if the diff
happens to be correct, because it destroys the property the product is sold on.

## Non-goals

These are excluded by strategy, not by schedule. An agent that "helpfully" adds one is doing damage.

- **Not a prototyping toy.** Generating a fresh application from a sentence is out of scope for v1
  ([01-product/01-scope-and-personas.md](../01-product/01-scope-and-personas.md)). The verification
  oracle requires an existing test harness to run against; without one, the system cannot tell the
  truth about its own output, which breaks the core promise.
- **Not a chat product.** There is no free-form conversation surface with an agent. Every interaction
  is a typed request, an artifact, or an approval decision.
- **Not a model.** No training, no fine-tuning. Models are pluggable inputs.
- **Not an IDE.** No editor, no autocomplete, no inline suggestions. That market is served.
- **Not autonomous merge.** The system never writes to a repository's default branch. A human
  approves, always ([FR-031](../01-product/03-functional-requirements.md)).

## The ethical position, stated as engineering constraints

These are product commitments with tests behind them, not values statements.

**The system does not claim success it cannot prove.** Any output presented as verified is backed by
a recorded command, its exit code, and its normalised output. Where verification did not run or did
not pass, the surface says so in those words. Enforced by
[02-architecture/06-verification-and-truthfulness.md](../02-architecture/06-verification-and-truthfulness.md)
and [NFR-010](../01-product/04-non-functional-requirements.md).

**The customer's source code goes only where the customer configured it to go.** Egress destinations
are an explicit allowlist; a deployment can be configured so that no source-derived token leaves the
host. Enforced by [02-architecture/13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)
and [NFR-007](../01-product/04-non-functional-requirements.md).

**Authorship is disclosed.** Every commit the system produces carries trailers naming the run, the
task, the model and the prompt version that produced it. A reviewer must never have to guess whether
a human or a machine wrote a line.

**Cost is visible before it is spent.** Every run declares a ceiling and refuses to exceed it. A user
is never surprised by a bill produced by a loop they did not authorise.
