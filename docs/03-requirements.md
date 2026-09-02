# Requirements

**25 functional requirements and 10 non-functional.** Cut from 150 and 42 by one test
([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)):

> Keep a requirement only if it is necessary for **one CVE to disappear from one real repository
> through a Preview a human approved.**

Everything that failed the test is in [07-deferred.md](07-deferred.md), one line and a reason each.
Nothing was deleted outright.

**Identifiers are permanent and are never renumbered or reused.** The gaps below are the cut made
visible: `FR-001, FR-004, FR-010, FR-032…` is what 150 requirements look like after 125 of them went
to Deferred. A requirement that stops applying is marked Withdrawn and its identifier is retired
— [FR-084](07-deferred.md) is the one that has been.

Test-suite shorthand in the **Verified by** column: `unit` (fast, no IO), `contract` (schema and API
conformance), `int` (integration against a real database and a real Rehearsal Room), `escape`
(hostile-payload suite, release-blocking), `replay` (Prompt Book fold and crash recovery).

## What a person gets

Twelve stories survive, from 48. A story with no requirement behind it is a wish; a requirement with
no story is scope creep. The rest are titles in [07-deferred.md](07-deferred.md).

**US-003 — Connect a House and find out immediately if it is unsuitable** · FR-001, FR-004
As an engineering lead, I connect a repository and learn at once whether Scenio can work with it.
*Given* a repository whose declared verification command does not pass on its base branch, *when* I
connect it, *then* the connection fails with the command, exit code and output, and no House is
created.

**US-009 — Never touch my default branch** · FR-010, FR-123
*Given* any Scene, including one where I explicitly ask for it, *when* delivery is attempted, *then*
Scenio refuses to target or push to the House's default branch.

**US-007 — Get a branch with the change and its proof** · FR-032, FR-033, FR-063
*Given* a Scene whose Dress Rehearsal passed and which I approved at The Call, *when* it completes,
*then* a Preview exists containing the change, and the Prompt Book holds every command that produced
it with its exit code.

**US-011 — Never be told something works when it was not checked** · FR-034, FR-132, NFR-018
*Given* any Scene presented as successful, *when* I inspect the Prompt Book, *then* there is a
verification entry with exit code 0, and no agent output could have produced that status without it.

**US-010 — Be told it failed, with evidence** · FR-039, FR-040
*Given* a Scene that exhausts its attempt cap, *when* it stops, *then* it is Held with each attempt's
patch, command, exit code and normalised failure, and the outcome is described as failed rather than
as partially complete.

**US-013 — Cap the spend before it happens** · FR-049, NFR-009
*Given* a Scene approaching its ceiling, *when* the next model call is estimated to exceed it, *then*
the call is refused before it is made and the Scene is Held, never exceeding the ceiling.

**US-002 — Refuse to run without isolation** · FR-055, NFR-002
*Given* the configured runtime is unavailable or fails its preflight check, *when* a Scene is started,
*then* it is refused with a message naming the check that failed, and no code is executed.

**US-041 — Know exactly what Scenio can do to my repository** · FR-122, FR-123, NFR-035
As a security reviewer, I want a boundary I can read and test rather than a promise.
*Given* Scenio's own application installation — never a person's access token — *when* I read the
permission envelope, *then* every prohibition has a test asserting the attempt fails inside Scenio's
own code and never reaches the git host.

**US-042 — Turn it off in one action, without asking you** · FR-126
As a security reviewer, *given* I revoke Scenio's installation at my git host, *when* it next attempts
an operation, *then* every affected Scene becomes Held, no retry is scheduled, and no further git
operation is attempted.

**US-025 — Check a comment in seconds instead of re-deriving it** · FR-088
As a reviewer reading Scenio's comments on my Preview, *when* I read one, *then* either it leads with
a command and an exit code I can re-run, or it leads with the word *unverified* — and the two never
look alike.

**US-037 — See the numbers that justify renewal** · FR-130, NFR-043
As the person who pays, *when* I open Box Office, *then* I see acceptance rate, cost per merged
Preview, human intervention rate and evidence rate, each with the count it was computed from and the
published query that produced it.

**US-014 — Answer an auditor from the Prompt Book** · FR-062, FR-063
*Given* any Scene, *when* I read its Prompt Book entries, *then* every execution and every model call
appears with what authorised it, and there is no path by which an entry could have been edited or
removed.

## Functional requirements

### Connecting a House — a repository

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-001 | Scenio MUST allow connecting a House with a name, a repository URL, a default base branch, a declared verification command and an execution image reference. | `contract`, `int` |
| FR-004 | Connecting a House MUST execute the declared verification command against the base branch in a Rehearsal Room and MUST refuse the connection if it does not exit 0, reporting the command, exit code and output. | `int` |

### Instantiating a Scene

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-081 | A Scene MUST be instantiated from a declared recipe supplying a fixed task template, and MUST reach the change step with **zero model calls** spent on planning. | `unit`, `int` |
| FR-083 | A dependency-upgrade Scene MUST record the manifest change and the resolved versions, and MUST reject a patch that modifies a dependency manifest without a consistent lockfile update. | `unit`, `int` |
| FR-010 | Scenio MUST refuse any Scene whose target branch is the House's default branch, including on explicit instruction. | `unit`, `contract`, `int` |

### Making the change

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-080 | The Crew MUST write only inside the Scene's declared paths; a patch modifying any path outside them MUST be rejected, after symlink resolution. | `unit`, `escape` |
| FR-035 | Patches MUST be expressed as exact-match search/replace edits; a block that does not match the target file byte-exactly and uniquely MUST be rejected with a structured error naming the file and the nearest candidate. Fuzzy matching MUST NOT exist. | `unit`, `int` |

FR-035 is also the **conflict detector** for optimistic
concurrency: a tree that moved underneath a patch produces a rejection rather than a silent corruption,
which is what makes running Scenes in parallel affordable
([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)). The re-plan that follows a
rejection is a behaviour of the Stage Manager rather than a separate gate, and its cost is measured by
[NFR-044](#non-functional-requirements).

### Dress Rehearsal — the verification run

FR-033 and FR-034 together are the mechanism behind UF-3. They are the two most likely to be weakened
by an agent trying to make a Scene succeed, and weakening them is the worst change that can be made to
Scenio.

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-033 | Verification MUST execute the Scene's declared command unmodified inside a Rehearsal Room, and its process exit code MUST be the sole determinant of pass or fail. | `unit`, `int` |
| FR-034 | No agent output MUST be able to change, override or bypass a verification result, and no agent MUST be able to modify a declared command after the Scene is instantiated. | `unit`, `int` |
| FR-039 | A Scene MUST fail after its attempt cap is reached and MUST become Held rather than starting a further attempt. | `unit`, `int` |
| FR-040 | A retry MUST be refused when the new attempt produced an identical patch, or an identical normalised failure with no reduction in failing count, relative to any previous attempt of that Scene. | `unit`, `int` |
| FR-049 | Before every model call, Scenio MUST estimate its cost with the real tokeniser and MUST refuse the call if it would exceed the Scene's ceiling; a refusal MUST make the Scene Held and MUST NOT substitute a cheaper model. | `unit`, `int` |

### The Rehearsal Room — the isolated execution environment

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-054 | Each Scene MUST get its own Rehearsal Room, created with explicit CPU, memory, process-count and disk limits and a per-execution timeout, and it MUST be destroyed when the Scene reaches a terminal state or exceeds an idle timeout. | `int`, `escape` |
| FR-055 | Rehearsal Rooms MUST be created with the configured runtime and no host path mounted in; if the runtime is unavailable or fails its preflight check, Scenio MUST refuse to execute and MUST NOT fall back to a weaker runtime. | `unit`, `int`, `escape` |
| FR-056 | No credential, token, model API key or host environment variable MUST be present inside a Rehearsal Room. | `escape` |
| FR-057 | Egress from a Rehearsal Room MUST be denied by default and permitted only to destinations on the recipe's declared allowlist; the model endpoint MUST NOT be on that allowlist; and every decision, allowed or denied, MUST be recorded in the Prompt Book. | `escape`, `int` |

### The Prompt Book — the audit log

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-062 | Prompt Book entries MUST be append-only; Scenio MUST NOT expose any update or delete path for them. | `unit`, `int` |
| FR-063 | Every process execution inside a Rehearsal Room and every model call MUST have a corresponding Prompt Book entry, written in the same transaction as the effect it records, containing what authorised it. An effect that cannot be recorded MUST NOT be performed. | `int`, `replay` |

### The Call and the Preview

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-032 | Scenio MUST NOT push any branch or open a Preview until a human approval for that Scene is recorded, together with what the approver was shown. | `int` |
| FR-122 | Scenio MUST authenticate to a git host as its **own** scoped application installation, or where the host offers none, a dedicated machine account. A personal access token belonging to a human MUST NOT be accepted as a repository credential. | `unit`, `int` |
| FR-123 | The repository permission envelope MUST be enforced where git requests are constructed, not only by the granted scope. Scenio MAY read contents and history, create and update branches under the reserved prefix, and open, update and comment on Previews. It MUST NOT push to a default or protected branch, force-push any ref, delete or rename a branch, create or move a tag or release, alter branch protection or settings, read CI secrets, merge, enable auto-merge, dismiss a review, or submit an approving review. | `unit`, `int`, `escape` |
| FR-126 | A missing or revoked repository permission MUST make the affected Scenes Held, naming the permission and the operation. It MUST NOT be retried, MUST NOT fall back to another credential or ref, and MUST NOT produce a degraded delivery. Revocation MUST take effect without any action on Scenio's side. | `int` |

### The judgement lane

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-088 | Every Prompter comment MUST carry an evidence state of exactly `demonstrated` or `unverified`. `demonstrated` MUST reference an evidence record holding the argv vector, the commit and patch digest of the tree it ran against, the exit code and the normalised output. An evidence record MUST NOT be recorded as a verification result and MUST NOT be able to mark a Scene verified. A concern with no executable form MUST be emitted labelled rather than suppressed. | `unit`, `contract`, `int` |

### Reporting

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-130 | Box Office MUST report, per lane and per task class over an explicit window: acceptance rate (Previews merged with no human edit over Previews opened), cost per merged Preview, human intervention rate (Scenes reaching Held over Scenes started), and evidence rate (comments with an artifact over comments posted). Every figure MUST be computed from the Prompt Book by a query published alongside it, and MUST NOT come from a rollup table, a cached value or a model output. | `int` |
| FR-132 | Every surface presenting an outcome MUST render: verification status as *verified*, *failed verification* or *not verified*; a Held Scene as waiting with its reason and never as a progress indicator; unknown values as "unknown" and never as zero; a measure with insufficient data as "insufficient data" with its count and never as a percentage; the lane visible before the content; and a `demonstrated` comment differently from an `unverified` one. A judgement-lane Scene MUST NOT be described with any of the three verification words. | `unit`, `int` |

## Non-functional requirements

Each is a number with a measurement method and a failure action. **Hard fail** means CI fails or
Scenio refuses to operate; **report only** means the figure is measured and published but gates
nothing yet.

**Two entries are `TBD` on purpose.** NFR-043 and NFR-044 are measures created by decisions taken
before any measurement exists. Inventing a plausible value would be indistinguishable from a measured
one later, and NFR-043's four numbers are shown to clients. The measurement is fixed now so they do
not stay TBD by neglect; the value is not.

| ID | Requirement | Measured by | On failure |
| --- | --- | --- | --- |
| NFR-002 | 100% of cases in the escape suite MUST pass on every pipeline run, against the real runtime and the real image. No tolerated failure, no quarantine list, no known-failures file. | `tests/escape/` in CI | hard fail |
| NFR-005 | A Rehearsal Room MUST have zero credential-shaped values in its environment, filesystem or process arguments, measured against a seeded corpus of at least 20 credential formats. | `tests/escape/` scanning a live room | hard fail |
| NFR-007 | Zero destinations outside the recipe's declared allowlist MUST be reachable from a Rehearsal Room at any point in its lifetime, and every attempt MUST produce a recorded Prompt Book entry. Cases MUST cover HTTP, raw TCP, DNS resolution and link-local metadata addresses. | `tests/escape/` | hard fail |
| NFR-009 | No Scene MUST exceed its declared ceiling. Terminal recorded spend MUST be ≤ ceiling for 100% of Scenes, with reconciliation error between estimate and actual ≤ $0.02 per Scene. | `tests/integration/`; nightly reconciliation over all Scenes | hard fail |
| NFR-010 | Attempts per Scene MUST NOT exceed the configured cap, counted from persisted attempts so that a restart cannot reset them. | `tests/unit/`, `tests/integration/` | hard fail |
| NFR-015 | 100% of Rehearsal Room executions and model calls MUST have a corresponding Prompt Book entry; a reconciliation query MUST return zero orphans. | `tests/integration/`; nightly reconciliation | hard fail |
| NFR-018 | Zero Scenes MUST report a successful outcome without a recorded verification entry with exit code 0, enforced as a database-level check and asserted nightly. | `tests/integration/`; SQL invariant query | hard fail |
| NFR-035 | Zero git operations outside the permission envelope MUST be constructible, with **one test per prohibition** in FR-123, each asserting the attempt fails inside Scenio's code and never reaches the git host. | `tests/escape/` | hard fail |
| NFR-043 | **Box Office: TBD.** All four numbers in FR-130 MUST be measured and published from the first client. What is measured is fixed: acceptance rate = Previews merged with no human edit ÷ Previews opened; cost per merged Preview = tokens plus compute ÷ Previews merged; human intervention rate = Scenes reaching Held ÷ Scenes started; evidence rate = comments with an artifact ÷ comments posted. No target value is set, because none has been observed. | Box Office queries over the Prompt Book, verified against a hand-checked sample of at least 20 merged Previews spanning a rebase, a squash and a concurrent unrelated commit | report only until a baseline exists; a **flattering** disagreement with the hand-checked sample is a defect |
| NFR-044 | **Re-run rate: TBD.** The share of Scenes re-planned because their base commit moved MUST be measured. Above roughly one Scene in five, sustained over a month across at least three Houses, optimistic concurrency is the wrong trade and exclusive claims return ([ADR-0031](03-adr/0031-optimistic-concurrency-not-exclusive-claims.md)). | Count of recorded re-plan events over Scenes started, per House | report only until a baseline exists |

## Explicit non-requirements

Stating these prevents engineering nobody asked for.

**No high availability.** One instance per client, one control plane. An outage delays work rather than
losing it.

**No horizontal scaling.** The expected load is a handful of concurrent Scenes per instance.

**No completion estimate.** A remaining count and a burn rate invite a projection, and any projection
from a handful of Scenes is invented.

**No quality gate on the judgement lane.** NFR-043's evidence rate is report-only, and there is no
target acceptance rate for comments. That is a property of work with no oracle, not an omission
([ADR-0022](03-adr/0022-two-lanes-verified-and-advisory.md)) — and it means the judgement lane ships
on a weaker guarantee than the verified one.

**No repositories without automated tests.** Refused at connection ([FR-004](#connecting-a-house--a-repository)).
Serving them would require asserting success Scenio cannot demonstrate.

**No internationalisation, no mobile layout, no browser support matrix.** The Booth is
server-rendered HTML for a desktop browser.
