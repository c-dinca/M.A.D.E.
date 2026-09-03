export const oneLiner =
  "Scenio does maintenance work that a command can prove, and a human approves the result.";

export const cover = {
  rail: "cover",
  billSecond: "a programme. not a product you can log into.",
  invite: "sit with it a second. paper starts when you scroll.",
  foot: "specification only · no code exists yet",
};

export const tonight = {
  rail: "tonight",
  heading: "What is playing",
  paragraphs: [
    "That is the whole of v1. One kind of work in the verified lane, one kind in the judgement lane, and nothing else.",
    "I'm Cristian. I'm one person. I don't have a running system to show you. If you came for a demo, this is me telling you that part hasn't happened.",
    "I put the specification on paper like this because a page of percentages I have not measured would be the opposite of the product.",
  ],
};

export const problem = {
  rail: "the problem",
  heading: "The work nobody schedules",
  paragraphs: [
    "Every engineering team carries a queue of work that is never the most important thing today and is always overdue. A CVE lands in a transitive dependency. The upgrade that fixes it breaks four call sites. Nobody schedules the afternoon.",
    "The available tools split that work and leave the expensive half. Dependabot and Renovate open the pull request and, when the upgrade breaks the build, leave a red one for a senior engineer. Claude Code and Cursor fix it well, and assume a person at a keyboard. Nobody watches a package bump across two hundred repositories. Review tools post comments a reader has to re-derive before they can act on them.",
  ],
};

export const lanes = {
  rail: "two lanes",
  heading: "Verified, or not. Never almost.",
  verified: {
    kicker: "verified",
    title: "Dependency upgrades and CVE remediation",
    body: "Scenio raises the dependency, fixes what the upgrade breaks, and the repository's own existing test suite decides whether it worked. The CVE disappears from the dependency tree and the suite stays green. Both are checkable by a machine.",
  },
  judgement: {
    kicker: "judgement",
    title: "Review, through evidence only",
    body: "Scenio writes the test that fails and demonstrates the problem, or it marks the comment unverified. It never posts an opinion formatted as a finding.",
  },
  facts: [
    {
      dt: "the question",
      dd: "Did the declared command exit zero? Or: is this comment worth reading?",
    },
    { dt: "who decides", dd: "The exit code. A human." },
    {
      dt: "output",
      dd: "A Preview (a pull request) with its proof. Or comments, each with evidence or marked unverified.",
    },
    {
      dt: "reported as",
      dd: "verified, failed verification, not verified. Those three words are reserved for the verified lane. Judgement never borrows them.",
    },
    {
      dt: "guarantee",
      dd: "A Scene reported verified has a recorded zero exit code. Judgement output carries no correctness guarantee.",
    },
  ],
  closer:
    "Judgement output carries no correctness guarantee, and the interface says so in those words. The verified lane's guarantee is only worth something if it is scoped honestly. A suggestion rendered like a proof destroys both.",
};

export const actors = [
  { role: "Stage Manager", duty: "the orchestrator. code, not an agent" },
  { role: "Crew", duty: "the agent that makes the change" },
  { role: "Prompter", duty: "the agent that reviews, through evidence only" },
];

export const houseTerms = [
  { role: "House", duty: "a connected repository" },
  { role: "Show", duty: "a long-term maintenance campaign" },
  { role: "Scene", duty: "one task within a Show" },
  { role: "Rehearsal Room", duty: "the isolated execution environment" },
  { role: "Dress Rehearsal", duty: "the complete verification run" },
  { role: "The Call", duty: "the human approval gate" },
  { role: "Preview", duty: "the pull request" },
  { role: "Opening Night", duty: "the merge into the main branch" },
  { role: "Held", duty: "a Scene stopped, waiting for a person" },
  { role: "Dropped Cue", duty: "a Scene that failed" },
  { role: "Prompt Book", duty: "the audit log of every Scene" },
  { role: "Box Office", duty: "the four effectiveness numbers" },
  { role: "Booth", duty: "the administration console" },
  { role: "Front of House", duty: "the chat entry point (deferred)" },
];

export const cast = {
  rail: "cast",
  heading: "The company",
  intro:
    "I use the theatre words so a log line, a conversation, and this page name the same things. Title first, then the plain description. Always.",
  actorsHead: "the actors",
  houseHead: "the house",
  closer:
    "Deliberately not “Production” for a Show. In any developer tool production means the live environment, and that ambiguity produces incidents.",
};

export type PromptLine = {
  ts: string;
  event: string;
  detail?: string;
  mark?: "fail" | "ok";
};

export const promptLines: PromptLine[] = [
  { ts: "14:01:03.102", event: "scene.created", detail: "recipe=dependency-upgrade" },
  { ts: "14:01:03.441", event: "rehearsal_room.created", detail: "runtime=container  mounts=0" },
  { ts: "14:01:03.518", event: "egress.denied", detail: "dest=169.254.169.254" },
  { ts: "14:01:18.003", event: "patch.applied", detail: "files=2" },
  { ts: "14:01:52.110", event: "dress_rehearsal.started", detail: 'argv=["pytest","-q"]' },
  { ts: "14:02:07.882", event: "dress_rehearsal.ended", detail: "exit 1", mark: "fail" },
  { ts: "14:02:08.001", event: "attempt.recorded", detail: "n=1" },
  { ts: "14:04:11.440", event: "patch.applied", detail: "files=3" },
  { ts: "14:04:12.002", event: "dress_rehearsal.started", detail: 'argv=["pytest","-q"]' },
  { ts: "14:04:41.118", event: "dress_rehearsal.ended", detail: "exit 0", mark: "ok" },
  { ts: "14:04:41.200", event: "verification.recorded", detail: "status=verified" },
  { ts: "14:12:02.000", event: "the_call.approved" },
  { ts: "14:12:03.551", event: "preview.opened", detail: "default_branch=no  merge=no" },
];

export const promptBook = {
  rail: "prompt book",
  heading: "What proof looks like",
  intro:
    "Every execution and every model call is written in the same transaction as the effect it records. If it cannot be logged, it does not happen. A Scene reported verified has a recorded zero exit code. That's the only definition.",
  caption: "Illustration. Not a recorded Scene. There is no run behind these lines. I wrote them.",
  after: [
    "The failed attempt stays in the book. A tidy log that omitted it would be the product lying to itself.",
    'A Scene that stops and says "I could not make the suite pass; here are the three attempts and what each failed on, at a cost of $0.14" is a success. A Scene that produces a plausible diff and claims it works is a failure even if the diff is correct, because it destroys the property everything else is built on. In the judgement lane the equivalent: a comment marked unverified is a success; a guess formatted as a proof is not.',
  ],
};

export const loop = {
  rail: "the loop",
  heading: "One Scene. One Preview.",
  intro:
    "One Scene is one task within a Show. That's the unit of execution and of delivery. One Scene produces one Preview: one pull request. The Stage Manager is code. It holds no prompt.",
  steps: [
    {
      n: "01",
      title: "Instantiate from a declared recipe",
      body: "Zero model calls. The plan is not generated.",
    },
    {
      n: "02",
      title: "Create the Rehearsal Room",
      body: "A container. No host path mounted in. No credentials. Egress denied by default. If the runtime is missing, refuse. There is no fallback.",
    },
    {
      n: "03",
      title: "Crew produces a patch",
      body: "Writes only inside the Scene's declared paths. Exact-match blocks, never a fuzzy apply.",
    },
    {
      n: "04",
      title: "Dress Rehearsal",
      body: "Run the declared command unmodified. The exit code decides. No model in this step.",
    },
    {
      n: "05",
      title: "The Call",
      body: "A person approves. Nothing is pushed before this.",
    },
    {
      n: "06",
      title: "Preview opened on the House",
      body: "Never the default branch. Never a merge. Opening Night is a human merging.",
    },
  ],
};

export const house = {
  rail: "the house",
  heading: "Who it's for",
  paragraphs: [
    "A team of five to fifty engineers with a repository that has a test suite and a maintenance queue nobody enjoys. They already have a git host, a container runtime and a chat client; Scenio needs no new infrastructure from them.",
    "A repository with no automated tests is not a v1 client. The verified lane has nothing to prove a change with, so Scenio refuses at connection rather than degrading.",
    "It runs as one isolated instance per client, operated by me. Not a shared multi-tenant service. A client's work never sits in a row next to another client's, because it never sits in the same database.",
    "The primary argument is maintenance work that is verified, and approved by a person. The security argument, that source stays inside a perimeter, is secondary. That's a commercial bet. I haven't closed it.",
  ],
};

export const boxOffice = {
  rail: "box office",
  heading: "Four numbers. None of them yet.",
  intro: [
    'Box Office reports acceptance rate, cost per merged Preview, human intervention rate, and evidence rate. Every figure is computed from the Prompt Book by a published query. A measure with too few observations renders as "insufficient data" with its count, never as a percentage.',
    "I will not put a made-up rate on this page. None has been observed. A plausible invented figure would be indistinguishable from a measured one later, and Box Office is shown to clients.",
  ],
  rows: [
    { role: "Acceptance rate", duty: "TBD" },
    { role: "Cost per merged Preview", duty: "TBD" },
    { role: "Human intervention rate", duty: "TBD" },
    { role: "Evidence rate", duty: "TBD" },
  ],
};

export const notPlaying = {
  rail: "not playing",
  heading: "Excluded by strategy, not by schedule",
  items: [
    {
      title: "Not feature development.",
      body: "There is no reliable command that decides whether a feature does what was meant, the work is attended, and competing there means competing on rented model quality.",
    },
    {
      title: "Not greenfield generation.",
      body: "The verified lane needs a test suite Scenio did not write.",
    },
    {
      title: "Not autonomous merge.",
      body: "Scenio opens a Preview. It cannot push to a default branch, cannot merge, cannot enable auto-merge and cannot submit an approving review.",
    },
    {
      title: "Not work without a runnable check.",
      body: '"Improve quality", "modernise this module", "make it faster" are judgement calls dressed as tasks.',
    },
    {
      title: "Not a chat product.",
      body: 'Front of House, the chat entry point, is deferred. When it exists it will offer a closed list of maintenance types, not "describe any change".',
    },
    {
      title: "Not a model.",
      body: "No training, no fine-tuning. Models are configured endpoints.",
    },
    {
      title: "Not an IDE.",
      body: "No editor, no autocomplete, no inline suggestions.",
    },
  ],
};

export const notes = {
  rail: "notes",
  heading: "What I am not claiming",
  paragraphs: [
    "Status: specification only. No code exists yet.",
    "Nothing here has ever run. I kept three questions open because they are commercial bets, not technical ones. If I closed them on this page I'd be inventing an answer I do not have.",
    "OQ-11. Is dependency and CVE work the right first lane, or are large migrations? Provisional: dependencies.",
    "If it flips, M2's exit criteria change and campaigns return from Deferred.",
    "OQ-15. Does the security-perimeter argument lead, or follow? Provisional: it follows.",
    "If it flips, hosted-first reverses and self-hosted becomes first.",
    "OQ-19. Is a narrow chat entry point enough, or does it need to accept any request? Provisional: narrow. This is a real reduction from the original vision, not a postponement.",
    "There is no price. I haven't set one.",
    "A CVE disappears from a real repository through a Preview a human approved, and the four Box Office numbers say what that cost. That sentence is the test. It has not happened yet.",
  ],
  colophon:
    "No customers. No testimonials. No dashboard. Red is reserved for failure. I used it once, on an illustrated exit 1.",
  tag: "the rehearsal is the work",
};
