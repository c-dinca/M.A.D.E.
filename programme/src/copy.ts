export const cover = {
  rail: "cover",
  bill: "I bump the package. I fix what broke. You merge.",
  foot: "not built yet",
};

export const job = {
  rail: "the job",
  heading: "The red PR",
  paragraphs: [
    "Dependabot opens it. When the upgrade breaks the build, it sits there. A senior has to finish it.",
    "That's the half I want. Your tests decide if it worked. You still click merge.",
  ],
};

export const lanes = {
  rail: "two things",
  heading: "That's all it does",
  verified: {
    kicker: "the upgrade",
    title: "Fix the break",
    body: "Bump the dependency. Repair the call sites. Run the suite you already have. Green, or it didn't happen.",
  },
  judgement: {
    kicker: "the review",
    title: "No vibes",
    body: "A failing test, or the comment is marked unverified. I don't get to sound sure.",
  },
};

export const actors = [
  { role: "Stage Manager", duty: "code. not an agent" },
  { role: "Crew", duty: "makes the change" },
  { role: "Prompter", duty: "reviews. evidence only" },
];

export const houseTerms = [
  { role: "Scene", duty: "one task" },
  { role: "The Call", duty: "you say yes" },
  { role: "Preview", duty: "the pull request" },
  { role: "Prompt Book", duty: "the log" },
];

export const cast = {
  rail: "cast",
  heading: "Who's on",
};

export type PromptLine = {
  ts: string;
  event: string;
  detail?: string;
  mark?: "fail" | "ok";
};

export const promptLines: PromptLine[] = [
  { ts: "14:01:03", event: "scene.created", detail: "dependency-upgrade" },
  { ts: "14:01:18", event: "patch.applied", detail: "files=2" },
  { ts: "14:01:52", event: "tests.ended", detail: "exit 1", mark: "fail" },
  { ts: "14:04:11", event: "patch.applied", detail: "files=3" },
  { ts: "14:04:41", event: "tests.ended", detail: "exit 0", mark: "ok" },
  { ts: "14:12:02", event: "you.approved" },
  { ts: "14:12:03", event: "preview.opened", detail: "no merge" },
];

export const promptBook = {
  rail: "the book",
  heading: "What proof looks like",
  caption: "I made this up. Nothing has run.",
  after: "The fail stays in. Cleaning it out would be lying.",
};

export const boxOffice = {
  rail: "box office",
  heading: "The numbers",
  intro: "I haven't shipped it, so I haven't measured it.",
  rows: [
    { role: "Accepted", duty: "TBD" },
    { role: "Cost per merge", duty: "TBD" },
    { role: "You had to step in", duty: "TBD" },
    { role: "Had evidence", duty: "TBD" },
  ],
};

export const notes = {
  rail: "anyway",
  heading: "That's the show",
  paragraphs: [
    "I'm Cristian. One person. No code yet. No price. No customers.",
    "Not a chat app. Not an IDE. It will not merge for you.",
  ],
  tag: "the rehearsal is the work",
};
