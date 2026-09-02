# ADR-0027 — The system authenticates as its own scoped application installation and may only create branches and pull requests

**Status:** Accepted
**Date:** 2026-09-02
**Relates to:** [UF-4](../02-architecture.md), [ADR-0015](0015-credential-brokering-no-secrets-in-sandbox.md), FR-031, FR-032, [19-repository-access.md](../02-architecture.md), FR-122 to FR-128

## Context

The founder has decided that the system has **direct write access** to the customer's repositories,
and that it works on **branches only**. That is a decision, not a question, so this record exists to
fix its boundary rather than to argue it.

The current specification is close but not explicit enough on two points. It says the credential needs
"read on the repository, write on non-default branches, and pull-request creation", that it "must not
have force-push, branch deletion, settings, or organisation scope", and — importantly — "where the host
supports finer grants, use them; where it does not, say so to the customer rather than implying a
restriction that is not enforced" ([14-integrations.md](../02-architecture.md)). What it
does not say is *whose* identity that credential belongs to, or what happens when a grant the system
expects turns out to be missing.

Both matter more than they look. A personal access token belonging to a human means every commit,
every branch and every audit entry on the customer's side is attributed to that person, their leaving
the company breaks the installation, and their other privileges — which are usually broad — become the
system's privileges. That is the opposite of the least-privilege story this product is sold on, and it
would be discovered in the first security review.

And a missing grant discovered mid-Run is a decision point where the wrong behaviour is very tempting:
retry, fall back, or work around it. Each of those turns an access boundary into a suggestion.

## Decision

**The system authenticates as its own identity: a dedicated application installation per tenant per
git-host account, with the narrowest grants the host offers** (FR-122). A personal access token
belonging to a human MUST NOT be accepted as a repository credential, in any deployment mode. Where a
host offers no application-installation mechanism, the credential MUST belong to a dedicated
machine account created for this purpose, and the customer-facing documentation MUST state which
restrictions below are enforced by the host and which are enforced only by us.

**The permission envelope is a hard boundary** (FR-123). It is enforced at the point requests are
constructed, not merely by the grant, so that a host misconfiguration cannot widen it. A test asserts
each prohibition.

The system MAY:

- read repository contents, metadata and history;
- create and update branches whose names begin with the reserved prefix `made/`;
- open, update, close and comment on pull requests it opened;
- read pull-request diffs, review comments and commit status or check results;
- comment on a pull request a human opened, when an advisory work class is enabled for that repository.

The system MUST NOT:

- push to the default branch or to any protected branch, under any circumstance, including explicit
  operator instruction ([FR-031](../03-requirements.md));
- force-push anything, to any ref;
- delete or rename any branch, including its own;
- create, move or delete a tag or a release;
- alter branch protection, repository settings, organisation settings, collaborators or teams;
- read, write or list CI secrets, environment secrets or deployment credentials;
- merge a pull request, enable auto-merge, or dismiss a review;
- submit an approving pull-request review — an approving review is a merge enabler, and the system
  does not participate in the merge decision even advisorily.

**Credentials stay control-plane side.** [ADR-0015](0015-credential-brokering-no-secrets-in-sandbox.md)
is unchanged and reinforced: no credential enters a Sandbox, no git command runs inside one, and
delivery is a control-plane effect gated on a recorded human approval
([FR-032](../03-requirements.md)).

**Required permissions are verified at registration and refused if absent** (FR-124). Registering a
repository enumerates the permissions the enabled work classes need and refuses registration if any is
missing, naming the permission and the class that needs it. A repository is never registered in a
partially working state.

**A missing or revoked permission at run time parks the Run; it is never retried or worked around**
(FR-125). The Run enters `AWAIT_HUMAN` with reason `access_insufficient`, naming the permission and the
operation that needed it. There MUST be no fallback path: no alternative credential, no push to a
different ref, no degraded delivery. This is the same shape as the isolation runtime's fail-closed
rule ([FR-055](../03-requirements.md)), for the same reason — a silent workaround
makes a documented boundary false while every test still passes.

**Revocation is one action on the customer's side and takes effect without our cooperation** (FR-126):
removing the application installation, or revoking the machine account's access, at the git host. On
the next attempted operation the system detects it, parks every affected Run with reason
`access_revoked`, stops attempting git effects for that repository, and surfaces the state in the
console. It MUST NOT retry on a schedule, and it MUST NOT require us to be reachable for revocation to
work. A tenant-side kill switch — disabling a Project, or the whole tenant — exists as well and is
recorded as an approval-class action (FR-127).

**Every git operation is recorded as an event with the operation, the ref, the identity used and the
outcome** (FR-128), so "what did it do to our repository" is a query rather than an investigation.

## Alternatives considered

### A personal access token supplied by an operator — rejected

The advocate's case is entirely about adoption, and it is not trivial. A token is one field in a form.
An application installation needs somebody with organisation-admin rights to approve it, which in a
large customer is a different team, a ticket and two weeks — and installation friction is already this
product's biggest adoption risk ([NFR-020](../03-requirements.md) exists
because of it). Many tools ship with a token and no security reviewer objects.

Rejected because it inverts the product's claim. A token carries the human's privileges, not the
system's: whatever they can push to, it can push to, and the host's own restrictions are theirs rather
than ours. Attribution on the customer's side becomes wrong — their audit log shows a person making
four hundred commits — and their offboarding process becomes our outage. For a product whose entire
differentiator is "here is exactly what it can do, and here is the proof", accepting a credential
whose scope we cannot describe is not a shortcut, it is the wrong product.

### Fork-and-pull instead of direct branch access — rejected

A genuinely strong alternative, and the one an external security reviewer often prefers: the system
holds no write access to the customer's repository at all. It forks, pushes to its own fork, and opens
a pull request across the fork boundary. The permission envelope shrinks to read plus pull-request
creation, and "what can it do to our repository" becomes "nothing".

It lost to a decision the founder has already taken — direct write access, branches only — and the
technical case against it is real: cross-fork pull requests do not run the target repository's CI with
secrets in most hosts' default configuration, which removes the customer's own checks from the loop and
makes the pull request less trustworthy rather than more. Fork-based delivery is retained as a
**deferred** option in [07-deferred.md](../07-deferred.md) because a
customer may require it, and the delivery mechanism is one module.

### Push to a branch, then let the system merge when checks pass — rejected

The case: it is the capability customers ask for within a week of adopting anything like this, it
removes the review bottleneck that limits worksite throughput
([ADR-0024](0024-worksites-as-long-running-campaigns.md) makes progress depend on human merges), and
"merge when green" is a rule a human wrote, not a model judgement.

Rejected because the human merge gate is the reason the installation gets approved at all, and
removing it removes the property the buyer's security function actually cares about. It also converts
a false-green verification into a merged commit with nobody in between, which upgrades a
[UF-3](../02-architecture.md) failure from
embarrassing to production-breaking.

### Retry or degrade on a missing permission — rejected

The case: permissions flap, hosts return spurious errors, and parking a worksite because one API call
returned 403 is operationally annoying.

Rejected because a permission error is a statement about authority, not about availability, and this
system's rule is that authority failures are never retried
([05-orchestration-and-termination.md](../02-architecture.md), policy
violations "not retried, because a repeat is a signal, not noise"). Genuine transient failures are
distinguishable by status class and are handled as availability errors; an authorisation failure parks.

## Consequences

### Positive

The permission envelope becomes something we can print, enforce and test, which is what turns a
security conversation into a checklist. Attribution on the customer's side is correct: their history
shows an application, not a person. Revocation is unilateral and immediate, which is the single most
reassuring property a customer can be offered about write access, and it costs them one click.
Least-privilege is real rather than claimed, and the audit answer to "what did it touch" is a query
over recorded git operations.

### Negative — mandatory

**Installation gets harder in exactly the place where friction is most expensive.** An application
installation needs an approval from someone who is not the person evaluating the product, and some
customers' processes will take longer than the evaluation. This will lose deals that a token field
would have won, and there is no engineering mitigation.

**Every git host is a separate integration with a separate permission model.** GitHub apps, GitLab
applications and anything else each have different grant granularity, different revocation semantics
and different behaviour when a grant is missing. The customer-facing statement of which restrictions
are host-enforced has to be written per host and kept accurate as they change it.

**Branch-only means the review bottleneck is permanent.** Worksite throughput is capped by the
customer's merge capacity ([ADR-0024](0024-worksites-as-long-running-campaigns.md)), and the answer to
"can it just merge the safe ones" is no. That will be asked repeatedly and the honest answer will
sometimes lose to a competitor who says yes.

**Parking on a permission error will look like a bug.** An operator whose worksite stopped because a
grant was changed will experience a correct fail-closed behaviour as an outage, and the console has to
explain it well enough that they do not go looking for a retry button.

**The reserved branch prefix is a constraint on the customer's repository**, and a customer whose
branch-protection rules or naming conventions conflict with `made/` has to change something, or we do.

## Revisit when

Either: a customer requires fork-based delivery as a purchase condition, which is a delivery-module
change and is already recorded as deferred; or a host removes the granularity this envelope depends on,
in which case the honest response is to narrow the capability offered on that host and say so, not to
widen the credential.
