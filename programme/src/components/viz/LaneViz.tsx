import { actors } from "../../copy";
import Actor from "./Actor";

export function VerifiedLane() {
  return (
    <div className="lane-viz" role="img" aria-label="A terminal. pytest exits zero. The Preview is marked verified.">
      <div className="term">
        <p className="term-bar">verification</p>
        <pre>
          <span className="term-cmd">$ pytest -q</span>
          {"\n"}412 passed
          {"\n"}
          <span className="ok">exit 0</span>
        </pre>
        <p className="pr-line">
          Preview #847
          <span className="pill ok">verified</span>
        </p>
      </div>
    </div>
  );
}

export function JudgementLane() {
  return (
    <div className="lane-viz" role="img" aria-label="The Prompter comments through evidence. One comment is demonstrated. One is unverified.">
      <div className="pr-card">
        <div className="pr-head">
          <Actor kind="prompter" name={actors.prompter.name} job={actors.prompter.job} compact />
        </div>
        <article className="evidence">
          <p className="evidence-test">test_billing_legacy</p>
          <p>fails on the branch, passes on base</p>
          <span className="pill ok">demonstrated</span>
        </article>
        <article className="evidence muted">
          <p>looks wrong</p>
          <span className="pill">unverified</span>
        </article>
      </div>
    </div>
  );
}
