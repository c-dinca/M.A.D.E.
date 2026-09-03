import { viz } from "../../copy";
import VizPanel from "./VizPanel";

export default function CheapHalf() {
  return (
    <VizPanel label="A bot opened the pull request. The editor waits. Review comments sit unread.">
      <div className="cheap">
        <article className="mini-card">
          <p className="mini-kicker">dependabot</p>
          <p className="mini-title">#412 protobuf 3.25.5</p>
          <p className="mini-ok">{viz.cheapBot}</p>
          <span className="fail-mark">{viz.cveBuild}</span>
        </article>
        <article className="mini-card editor">
          <p className="mini-kicker">{viz.cheapEditor}</p>
          <pre className="editor-line">
            MessageToDict(msg)
            <span className="caret" />
          </pre>
          <p className="mini-wait">{viz.cheapWait}</p>
        </article>
        <article className="mini-card stack">
          <p className="mini-kicker">review</p>
          <ul className="comment-stack">
            <li>please re-derive this</li>
            <li>tests?</li>
            <li>same as last time</li>
          </ul>
          <p className="mini-wait">{viz.cheapComments}</p>
        </article>
      </div>
    </VizPanel>
  );
}
