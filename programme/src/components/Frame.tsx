import type { PlayStep } from "../copy";
import { play } from "../copy";
import CastRail, { activeForFig } from "./viz/CastRail";
import StepViz from "./viz/StepViz";

type Props = {
  step: PlayStep;
};

export default function Frame({ step }: Props) {
  return (
    <div className="frame" aria-live="polite">
      <div className="frame-bar">
        <span className="frame-fig">Fig {step.fig}</span>
        <span className="frame-house">{play.house}</span>
        <span className={`pill ${step.tone}`}>{step.status}</span>
      </div>
      <CastRail active={activeForFig(step.fig)} />
      <p className="frame-scene">{play.scene}</p>
      <StepViz step={step} />
      {step.diff ? (
        <div className="diff">
          <p className="diff-file">{step.diff.file}</p>
          <pre>
            {step.diff.lines.map((line) => (
              <span key={line.text} className={`ln ${line.kind}`}>
                {line.kind === "del" ? "- " : line.kind === "add" ? "+ " : "  "}
                {line.text}
              </span>
            ))}
          </pre>
        </div>
      ) : null}
      <div className="log">
        {step.log.map((line) => (
          <div className="log-line" key={`${line.t}-${line.text}`}>
            <span className="ts">{line.t}</span>
            <span className={line.mark ?? ""}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
