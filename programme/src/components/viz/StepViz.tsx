import type { PlayStep } from "../../copy";
import { actors, viz } from "../../copy";
import Actor from "./Actor";
import RoomBox from "./RoomBox";

type Props = {
  step: PlayStep;
};

export default function StepViz({ step }: Props) {
  switch (step.fig) {
    case "04":
      return (
        <div className="step-viz">
          <div className="recipe-card">
            <p className="mini-kicker">recipe</p>
            <p className="recipe-name">{viz.recipeName}</p>
            <ol>
              {viz.recipeSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p className="model-calls">{viz.modelCalls}</p>
          </div>
        </div>
      );
    case "05":
      return (
        <div className="step-viz">
          <RoomBox compact />
        </div>
      );
    case "06":
      return (
        <div className="step-viz fail-board">
          <p className="exit fail">exit 1</p>
          <p className="exit-sub fail">4 failed</p>
          <Actor kind="crew" name={actors.crew.name} job={actors.crew.job} compact working />
        </div>
      );
    case "07":
      return (
        <div className="step-viz pass-board">
          <p className="exit ok">exit 0</p>
          <p className="exit-sub ok">412 passed</p>
          <Actor kind="crew" name={actors.crew.name} job={actors.crew.job} compact />
        </div>
      );
    case "08":
      return (
        <div className="step-viz call-board">
          <Actor kind="you" name={actors.you.name} job={actors.you.job} compact />
          <button className="approve" type="button" tabIndex={-1} aria-hidden="true">
            Approve
          </button>
        </div>
      );
    case "09":
      return (
        <div className="step-viz preview-board">
          <p className="mini-kicker">Preview</p>
          <p className="preview-num">#847</p>
          <p className="preview-ref">scenio/protobuf-3.25.5 to main</p>
          <span className="lock-pill">{viz.cannotMerge}</span>
        </div>
      );
    default:
      return null;
  }
}
