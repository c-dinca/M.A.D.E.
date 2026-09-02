# Scenio — the product

## The problem

Every engineering team carries a queue of work that is never the most important thing today and is
always overdue. A CVE lands in a transitive dependency. The upgrade that fixes it breaks four call
sites. Nobody schedules the afternoon.

The available tools split that work and leave the expensive half. Dependabot and Renovate open the pull
request and, when the upgrade breaks the build, leave a red one for a senior engineer. Claude Code and
Cursor fix it well, and assume a person at a keyboard — nobody watches a package bump across two
hundred repositories. Review tools post comments a reader has to re-derive before they can act on
them.

## What Scenio is

**Scenio does maintenance work that a command can prove, and a human approves the result.**

That is the whole of v1. One kind of work in the verified lane, one kind in the judgement lane, and
nothing else ([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)):

**Verified — dependency upgrades and CVE remediation.** Scenio raises the dependency, fixes what the
upgrade breaks, and the repository's own existing test suite decides whether it worked. The CVE
disappears from the dependency tree and the suite stays green. Both are checkable by a machine, which
is why this work was chosen first (provisional — [OQ-11](06-open-questions.md)).

**Judgement — review of a human's pull request, exclusively through evidence.** Scenio writes the test
that fails and demonstrates the problem, or it marks the comment unverified. It never posts an opinion
formatted as a finding ([ADR-0023](03-adr/0023-advisory-findings-carry-evidence.md)).

It runs as **one isolated instance per client, operated by us** — not a shared multi-tenant service
([ADR-0029](03-adr/0029-hosted-first-one-instance-per-client.md)). A client's work never sits in a row
next to another client's, because it never sits in the same database.

### The distinction the product rests on

The two lanes have different trust models and must never be confused
([ADR-0022](03-adr/0022-two-lanes-verified-and-advisory.md)).

| | Verified lane | Judgement lane |
| --- | --- | --- |
| The question | Did the declared command exit zero? | Is this comment worth reading? |
| Who decides | The exit code | A human |
| Output | A Preview — a pull request — with its proof | Comments, each with evidence or marked unverified |
| Reported as | *verified*, *failed verification*, *not verified* | Its comments and their evidence state — **never** those three words |
| Guarantee | A Scene reported verified has a recorded zero exit code | **None.** Judgement output carries no correctness guarantee |

**Judgement output carries no correctness guarantee, and the interface says so in those words.** The
verified lane's guarantee is only worth something if it is scoped honestly. A suggestion rendered like
a proof destroys both.

## Who it is for

A team of five to fifty engineers with a repository that has a test suite and a maintenance queue
nobody enjoys. They already have a git host, a container runtime and a chat client; Scenio needs no
new infrastructure from them.

**A repository with no automated tests is not a v1 client.** The verified lane has nothing to prove a
change with, so Scenio refuses at connection rather than degrading
([FR-004](03-requirements.md)). Generating the missing tests is a separate lane for later
([07-deferred.md](07-deferred.md)).

The primary argument is **maintenance work that is verified, and approved by a person.** The security
argument — that source stays inside a perimeter — is secondary, an FAQ answer and a section in the
security documentation, not the lead. That relegation is a commercial bet and it is
[OQ-15](06-open-questions.md).

## Non-goals

Excluded by strategy, not by schedule. Anything postponed rather than excluded is in
[07-deferred.md](07-deferred.md), with its reason.

- **Not feature development.** There is no reliable command that decides whether a feature does what
  was meant, the work is attended, and competing there means competing on rented model quality.
- **Not greenfield generation.** The verified lane needs a test suite Scenio did not write.
- **Not autonomous merge.** Scenio opens a Preview. It cannot push to a default branch, cannot merge,
  cannot enable auto-merge and cannot submit an approving review
  ([FR-123](03-requirements.md)).
- **Not work without a runnable check.** "Improve quality", "modernise this module", "make it faster"
  are judgement calls dressed as tasks. In the verified lane they are refused. In the judgement lane
  they are refused as *tasks* and permitted only as comments that carry evidence or say they do not.
- **Not a chat product.** Front of House — the chat entry point — is deferred. When it exists it will
  offer a closed list of maintenance types, not "describe any change" ([OQ-19](06-open-questions.md)).
- **Not a model.** No training, no fine-tuning. Models are configured endpoints.
- **Not an IDE.** No editor, no autocomplete, no inline suggestions.

## What winning looks like

**A CVE disappears from a real repository through a Preview a human approved, and the four Box Office
numbers say what that cost.** That sentence is also the test that decided which requirements survive
([ADR-0033](03-adr/0033-one-verified-lane-one-judgement-lane.md)).

The counterfactual matters more than the demo. A Scene that stops and says "I could not make the suite
pass; here are the three attempts and what each failed on, at a cost of $0.14" is a success. A Scene
that produces a plausible diff and claims it works is a failure even if the diff is correct, because it
destroys the property everything else is built on. In the judgement lane the equivalent: a comment
marked *unverified* is a success; a guess formatted as a proof is not.

---

# The brand

The company and the product are **Scenio**.

The logo is the wordmark in lower case, with the dot of the `i` detached and coloured amber. No icon,
no descriptor of the "Solutions" kind.

## Colour

| Role | Value |
| --- | --- |
| Amber — the single accent | `#E8A33D` |
| Amber, light states | `#F2C275` |
| Amber text on a light background | `#B87421` |
| Black | `#0D0D0F` |
| Paper white | `#F5F3EF` |
| Secondary grey | `#8A8A93` |

**Red is reserved for failure.** Nothing else uses it — not warnings, not emphasis, not a brand
gradient. A red thing in a Scenio surface means something did not work.

## Typography

One sans family for the interface. Monospace for code, logs and the Prompt Book. **The contrast
between the two is the identity** — there is no third family and no display face.

## Vocabulary

The theatre term is the title. Under it, always, the plain description. **A theatre term never
appears alone.**

| Term | What it is |
| --- | --- |
| **House** | a connected repository |
| **Show** | a long-term maintenance campaign |
| **Scene** | one task within a Show — the unit of execution and delivery |
| **Rehearsal Room** | the isolated execution environment |
| **Dress Rehearsal** | the complete verification run |
| **Preview** | the pull request |
| **Opening Night** | the merge into the main branch |
| **The Call** | the human approval gate |
| **Held** | a Scene stopped, waiting for a person |
| **Dropped Cue** | a Scene that failed |
| **Booth** | the administration console |
| **Prompt Book** | the audit log of every Scene |
| **Box Office** | the four effectiveness numbers |
| **Front of House** | the chat entry point (deferred) |
| **Stage Manager** | the orchestrator — code, not an agent |
| **Crew** | the agent that makes the change |
| **Prompter** | the agent that reviews, through evidence only |

**Deliberately not "Production" for a Show.** In any developer tool *production* means the live
environment, and that ambiguity produces incidents. A campaign is a **Show**. The word *production*
appears in Scenio material only when it means a running environment.

These terms are binding in the same way the previous glossary was: they appear in code, database
columns, API fields, event kinds, log messages and user-facing text. A synonym in code is a
review-blocking defect, not a style preference — an agent reading a log line, a database row and an
API response must be able to tell they describe the same thing without inferring it.

### What a client may rename

Their own Shows, their own configurations, and the members of their own agent crew. **Not the
concepts.** House, Scene, Preview and the rest are the product's vocabulary and renaming them makes
support conversations impossible.

Plus a **`Theatre mode` / `Plain mode` switch** — a single label map, one flag, no second interface —
for clients who want dry terms. `Plain mode` renders House as *repository*, Scene as *task*, Preview
as *pull request*, Prompt Book as *audit log*, and so on down the table. The concepts are identical;
only the labels change.

## Tone of voice

Sober and dry. No exclamation marks. No enthusiasm about our own capability.

The product's promise is that **opening night is boring, because everything was rehearsed
beforehand.** Errors are not apologised for and are never vague: they name the command, the exit code
and what to do. Unknown values say "unknown". A measure computed from too few observations says
"insufficient data" and gives the count.

The position, in one line: **the rehearsal is the work.**

### One selling rule, and it is not optional

**Never demonstrate Front of House — the chat entry point — without saying, in the same sentence, that
the list of maintenance types is closed.** The narrow version and "describe any change" look identical
in a demo and diverge the first time somebody asks for something no recipe fits. Demonstrating one and
delivering the other is how a product loses a client in week two
([ADR-0025](03-adr/0025-chat-front-door-request-broker.md), [OQ-19](06-open-questions.md)).
