export const meta = {
  title: "Scenio",
  description: "Maintenance a command can prove. A human approves the result.",
};

export const hero = {
  line: "A CVE lands in a package you did not pick.",
  sub: "The upgrade that fixes it breaks four call sites. The afternoon never gets scheduled. Scenio takes that afternoon, and a command decides whether it worked.",
};

export const beats = [
  {
    fig: "01",
    title: "It arrives in a lockfile you last touched in March.",
    body: "A high advisory, pulled in through three packages you do not own. Dependabot opens a pull request. The build goes red. A senior is supposed to finish it. They have a launch on Thursday.",
  },
  {
    fig: "02",
    title: "The tools already do the cheap half.",
    body: "The bot opens the request. An editor would finish it, if someone sat down. Review tools post comments a reader has to re-derive before they can act. The expensive half is the sitting down.",
  },
  {
    fig: "03",
    title: "So the afternoon happens without you.",
    body: "Scenio raises the dependency, repairs the call sites, and runs the suite you already have. You are shown what ran. You still click merge. It will not merge for you.",
  },
];

export type PlayStep = {
  fig: string;
  title: string;
  body: string;
  status: string;
  tone: "idle" | "run" | "fail" | "ok" | "held";
  log: { t: string; text: string; mark?: "fail" | "ok" }[];
  diff?: { file: string; lines: { kind: "del" | "add" | "ctx"; text: string }[] };
};

export const play: {
  kicker: string;
  house: string;
  scene: string;
  steps: PlayStep[];
} = {
  kicker: "One Scene. A Scene is one task.",
  house: "acme/payments-api",
  scene: "protobuf 3.20.1 to 3.25.5",
  steps: [
    {
      fig: "04",
      title: "The plan is a recipe. Nobody asks a model for one.",
      body: "A Scene starts from a declared recipe. It reaches the change with zero model calls spent on planning. The work is named before any token is spent.",
      status: "Created",
      tone: "idle",
      log: [
        { t: "14:01:03", text: "scene.created  recipe=dependency-upgrade" },
        { t: "14:01:04", text: "plan.model_calls  0" },
      ],
    },
    {
      fig: "05",
      title: "A room comes up. There is nothing in it to steal.",
      body: "The Rehearsal Room is the isolated environment: a container, no host path, no credentials, egress denied except the registries the recipe named. If the runtime is missing, nothing runs.",
      status: "Room up",
      tone: "run",
      log: [
        { t: "14:01:03", text: "scene.created  recipe=dependency-upgrade" },
        { t: "14:01:04", text: "plan.model_calls  0" },
        { t: "14:01:11", text: "room.created  net=allowlist credentials=0" },
      ],
    },
    {
      fig: "06",
      title: "First patch. The suite you already have says no.",
      body: "That is the useful failure. The log keeps the exit code. Cleaning it out would be lying.",
      status: "Failed",
      tone: "fail",
      diff: {
        file: "pyproject.toml",
        lines: [
          { kind: "del", text: "protobuf = \"3.20.1\"" },
          { kind: "add", text: "protobuf = \"3.25.5\"" },
        ],
      },
      log: [
        { t: "14:01:11", text: "room.created  net=allowlist credentials=0" },
        { t: "14:01:40", text: "patch.applied  files=2" },
        { t: "14:02:18", text: "exec  pytest -q", mark: "fail" },
        { t: "14:02:18", text: "exit 1  4 failed", mark: "fail" },
      ],
    },
    {
      fig: "07",
      title: "Second patch. Four call sites. Then the suite says yes.",
      body: "The Dress Rehearsal is the verification run: the declared command, unmodified. The exit code is the only thing that decides. No agent output can change it.",
      status: "Verified",
      tone: "ok",
      diff: {
        file: "billing/legacy.py",
        lines: [
          { kind: "del", text: "MessageToDict(msg)" },
          { kind: "add", text: "MessageToDict(msg, preserving_proto_field_name=True)" },
        ],
      },
      log: [
        { t: "14:02:18", text: "exit 1  4 failed", mark: "fail" },
        { t: "14:08:02", text: "patch.applied  files=5" },
        { t: "14:08:41", text: "exec  pytest -q", mark: "ok" },
        { t: "14:08:41", text: "exit 0  412 passed", mark: "ok" },
      ],
    },
    {
      fig: "08",
      title: "You are shown every command that ran. Then you say yes.",
      body: "The Call is the approval gate. Nothing is pushed before it. The Prompt Book is the log: append-only, one entry per effect, written in the same transaction as the work.",
      status: "The Call",
      tone: "held",
      log: [
        { t: "14:08:41", text: "exit 0  412 passed", mark: "ok" },
        { t: "14:09:00", text: "prompt_book.complete  entries=14" },
        { t: "14:12:02", text: "approval.recorded  shown=digest:9f3a" },
      ],
    },
    {
      fig: "09",
      title: "A pull request opens. Not on main. Not a merge.",
      body: "The Preview is the pull request. Scenio authenticates as its own installation. It cannot push the default branch, cannot merge, cannot enable auto-merge, cannot submit an approving review.",
      status: "Preview",
      tone: "ok",
      log: [
        { t: "14:12:02", text: "approval.recorded  shown=digest:9f3a" },
        { t: "14:12:03", text: "preview.opened  #847  base=main" },
        { t: "14:12:03", text: "ref  scenio/protobuf-3.25.5" },
      ],
    },
  ],
};

export const lanes = {
  fig: "10",
  title: "Two kinds of work. They do not share a vocabulary.",
  verified: {
    kicker: "Verified",
    question: "Did the declared command exit zero?",
    body: "A Preview with its proof. Reported as verified, failed verification, or not verified. A Scene reported verified has a recorded zero exit code.",
  },
  judgement: {
    kicker: "Judgement",
    question: "Is this comment worth reading?",
    body: "The Prompter reviews a human's pull request through evidence only: the test that fails on the branch and passes on its base, or the word unverified. No correctness guarantee. Those three verified words are not used here.",
  },
};

export const instance = {
  fig: "11",
  title: "Your instance. Your database. No one else's row.",
  body: "One isolated instance per client, operated by us. Source does not sit next to another client's, because it does not sit in the same database. The Rehearsal Room holds no tokens. The model endpoint is not on its allowlist.",
};

export const close = {
  title: "Opening night is boring, because everything was rehearsed.",
  tag: "the rehearsal is the work",
  note: "Not a chat product. Not an IDE. Not feature work. A repository with no suite is refused at the door.",
};
