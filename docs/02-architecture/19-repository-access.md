# Repository access and the permission envelope

The system has direct write access to the customer's repositories and works on branches only. That is
decided ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)). This document is the
boundary, written so that a security reviewer can read it, test it, and revoke it.

The reviewer's three questions are the structure of the document: *whose identity is it, what exactly
can it do, and how do I stop it.*

## Whose identity

**The system authenticates as its own identity**: a dedicated application installation per tenant per
git-host account, with the narrowest grants the host offers
([FR-122](../01-product/03-functional-requirements.md)).

**A personal access token belonging to a human MUST NOT be accepted**, in any deployment mode. The
reason is not fastidiousness. A token carries the human's privileges rather than the system's: whatever
they can push to, it can push to, and the host's restrictions become theirs rather than ours. Their
audit log shows a person making four hundred commits. Their offboarding process becomes our outage. For
a product whose differentiator is "here is exactly what it can do, and here is the proof", accepting a
credential whose scope we cannot describe is the wrong product.

Where a host offers no application-installation mechanism, the credential belongs to a **dedicated
machine account** created for the purpose, and the customer-facing documentation MUST state which
restrictions below are enforced by the host and which are enforced only by us. This continues the rule
already in [14-integrations.md](14-integrations.md): *where the host does not support a finer grant, say
so rather than implying a restriction that is not enforced.*

Credentials stay control-plane side, unchanged from
[ADR-0015](../03-adr/0015-credential-brokering-no-secrets-in-sandbox.md): no credential enters a
Sandbox, no git command runs inside one, workspaces are populated by file transfer from the mirror, and
delivery is a control-plane effect gated on a recorded human approval
([FR-032](../01-product/03-functional-requirements.md)).

## What exactly it can do

**The envelope is enforced where git requests are constructed, not merely by the granted scope**
([FR-123](../01-product/03-functional-requirements.md)). A host misconfiguration that grants more MUST
NOT widen what the system does. There is one test per prohibition, and each asserts that the attempt
fails inside our code and never reaches the host
([NFR-035](../01-product/04-non-functional-requirements.md)).

### MAY

- Read repository contents, metadata and history.
- Create and update branches whose names begin with the reserved prefix `made/`.
- Open, update, close and comment on pull requests it opened.
- Read pull-request diffs, review comments and commit status or check results.
- Comment on a pull request a human opened, where an advisory work class is enabled for that
  repository.

### MUST NOT

| Prohibited | Because |
| --- | --- |
| Push to the default branch or any protected branch — **including on explicit operator instruction** | [FR-031](../01-product/03-functional-requirements.md). The structural guarantee the buyer's security function actually cares about |
| Force-push any ref | A force-push can destroy history that the audit trail assumes is immutable |
| Delete or rename any branch, including its own | Deletion is unrecoverable and the system has no reason to need it. Its own abandoned branches are the reviewer's evidence |
| Create, move or delete a tag or a release | A tag is a release artifact; moving one changes what a deployment pipeline builds |
| Alter branch protection, repository or organisation settings, collaborators or teams | Altering protection would let the system remove its own restrictions, which makes every other prohibition conditional |
| Read, write or list CI secrets, environment secrets or deployment credentials | The most direct privilege escalation available: CI secrets are usually production credentials |
| Merge a pull request, or enable auto-merge | The human merge gate is the reason the installation is approved ([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)) |
| Dismiss a review | Dismissing a human's review is editing the record of a human decision |
| Submit an **approving** pull-request review | An approving review is a merge enabler. The system does not participate in the merge decision, even advisorily. This is what keeps an advisory finding from becoming a merge signal |

Two related boundaries already exist elsewhere and are load-bearing here:

**A patch may not modify CI configuration, git hooks or submodule pointers**
([FR-036](../01-product/03-functional-requirements.md), `GUARD_PATCH_POLICY`). Without it an agent can
grant itself arbitrary execution on the customer's runners — the same escalation the CI-secrets
prohibition closes from the other side.

**An advisory Run may not patch or push the branch under review**
([FR-091](../01-product/03-functional-requirements.md)). It writes only inside its own evidence
workspace, and its evidence reaches the reviewer as an attached artifact or as a branch under the
reserved prefix.

## The reserved branch prefix

Every branch the system creates begins with `made/`, and `made/run-<run_id_short>` remains the naming
scheme ([FR-012](../01-product/03-functional-requirements.md)).

The prefix does three jobs: it makes the envelope enforceable as a string comparison rather than a
judgement; it makes "what did this system create in our repository" answerable by a branch listing; and
it lets the customer write their own branch-protection rule covering everything outside it.

The cost is a constraint on the customer's repository. A customer whose branch-protection rules or
naming conventions conflict with `made/` has to change something, or we do
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

## How the customer stops it

Two mechanisms, and the first is the one that matters because it does not depend on us.

**Revocation at the git host** ([FR-126](../01-product/03-functional-requirements.md)). The customer
removes the application installation, or revokes the machine account's access. One action, on their
side, effective immediately, **without our cooperation and without us being reachable.**

What happens next is specified rather than emergent:

1. The next attempted git operation fails with an authorisation status.
2. Every affected Run parks in `AWAIT_HUMAN` with reason `access_revoked`.
3. Git operations for that repository stop being attempted.
4. **No retry is scheduled.** Not with backoff, not on the next cycle, not by the scheduler.
5. Worksites holding claims on that repository pause; their claims are released.
6. The console shows the state, on the repositories page.

**A tenant-side kill switch** ([FR-127](../01-product/03-functional-requirements.md)). An administrator
disables a Project, or the whole tenant, in the console. Recorded with its actor. This is the faster
path when the customer wants to stop the system rather than remove its access — and it is ours, so it
is the weaker of the two, which is why revocation at the host is specified first.

## When a permission is missing

The tempting behaviours here are all wrong, and each is wrong for a reason this repository has already
settled elsewhere.

**At registration: refuse** ([FR-124](../01-product/03-functional-requirements.md)). Registering a
repository enumerates the permissions the enabled work classes require and refuses if any is absent,
naming the permission and the class that needs it. A repository is never registered in a partially
working state. This is [FR-004](../01-product/03-functional-requirements.md)'s shape — refuse at
registration rather than accept and degrade.

**At run time: park, fail closed**
([FR-125](../01-product/03-functional-requirements.md)). The Run enters `AWAIT_HUMAN` with reason
`access_insufficient`, naming the permission and the operation that needed it. There MUST be no
fallback: no alternative credential, no push to a different ref, no degraded delivery, no retry.

A permission error is a statement about **authority**, not about availability, and authority failures
are never retried in this architecture — the same rule that makes a patch-policy violation escalate
immediately rather than count as a retryable Attempt
([05-orchestration-and-termination.md](05-orchestration-and-termination.md), "not retried, because a
repeat is a signal, not noise"). Genuine transient failures are distinguishable by status class and are
handled as availability errors.

This is the same shape as the isolation runtime's fail-closed rule
([FR-055](../01-product/03-functional-requirements.md)) and it exists for the same reason: **a silent
workaround makes a documented boundary false while every test still passes.**

The honest cost: an operator whose worksite stopped because a grant changed will experience correct
fail-closed behaviour as an outage. The console has to explain it well enough that they do not go
looking for the retry button that does not exist
([ADR-0027](../03-adr/0027-scoped-application-identity-branches-only.md)).

## Audit

**Every git operation is recorded as an event** carrying the operation, the ref, the identity used and
the outcome ([FR-128](../01-product/03-functional-requirements.md)). Combined with the existing
execution and egress records, "what did it do to our repository" is a SQL query rather than an
investigation — which is the whole return on the audit design
([09-audit-and-replay.md](09-audit-and-replay.md)).

Commits carry trailers naming the run, task, attempt, verification command, model and prompt version
([FR-044](../01-product/03-functional-requirements.md)), so authorship is disclosed in the customer's
own history and a reviewer never has to guess whether a human or a machine wrote a line.

## Per-host reality

The envelope is what we enforce. What the **host** enforces varies, and the difference must be stated
to the customer rather than blurred.

| Restriction | Enforced by us | Enforced by the host |
| --- | --- | --- |
| Branch prefix | Always, at request construction | Only where the host supports ref-pattern grants |
| No default-branch push | Always | Where branch protection is configured by the customer |
| No force-push | Always | Where the host supports withholding it |
| No settings or protection changes | Always | Where the grant excludes the scope |
| No CI-secret access | Always | Where the grant excludes the scope |
| No merge or approving review | Always | Rarely separable from write access on any host |

The rule for customer-facing material: **describe what we enforce, name what the host enforces, and do
not present the union as though it were all host-enforced.** A restriction that exists only in our code
is still a restriction — it is tested, and the test is the evidence — but a security reviewer is
entitled to know which is which, and claiming otherwise is the kind of overstatement that gets found.

## What is deliberately not built

**No fork-based delivery in v1.** The system would hold no write access at all: fork, push to its own
fork, open a cross-fork pull request. It is the alternative an external reviewer often prefers and it
is **deferred, not rejected** ([01-product/10-deferred-scope.md](../01-product/10-deferred-scope.md)) —
partly because the founder decided on direct branch access, and partly because cross-fork pull requests
do not run the target repository's CI with secrets in most hosts' default configuration, which removes
the customer's own checks from the loop. It is one module, which is why it is affordable to defer.

**No merge, no auto-merge, no approving review.** This will be asked for within a week of adoption,
because worksite throughput is capped by the customer's merge capacity
([01-product/07-worksites.md](../01-product/07-worksites.md)). The answer is no, and a competitor who
says yes will win some deals on it.

**No repository creation, and no organisation-level operations.**

**No credential in a Sandbox**, ever
([ADR-0015](../03-adr/0015-credential-brokering-no-secrets-in-sandbox.md)).

**No retry on an authorisation failure**, and no code path that could add one.
