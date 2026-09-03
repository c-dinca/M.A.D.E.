type Kind = "crew" | "prompter" | "you";

type Props = {
  kind: Kind;
  name: string;
  job: string;
  working?: boolean;
  compact?: boolean;
};

export default function Actor({ kind, name, job, working, compact }: Props) {
  return (
    <div className={`actor actor-${kind} ${working ? "is-working" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="actor-body" aria-hidden="true">
        <span className="actor-head" />
        <span className="actor-torso" />
        <span className="actor-arm-l" />
        <span className="actor-arm-r" />
        {kind === "crew" ? <span className="actor-keys" /> : null}
        {kind === "prompter" ? <span className="actor-book" /> : null}
        {kind === "you" ? <span className="actor-btn" /> : null}
      </div>
      <p className="actor-name">{name}</p>
      {compact ? null : <p className="actor-job">{job}</p>}
    </div>
  );
}
