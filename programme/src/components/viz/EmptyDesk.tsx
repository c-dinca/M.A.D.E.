import { viz } from "../../copy";
import VizPanel from "./VizPanel";

export default function EmptyDesk() {
  return (
    <VizPanel label="An empty desk. Thursday is a launch. The pull request is red. Nobody sat down.">
      <div className="desk">
        <div className="cal">
          <p className="mini-kicker">Thursday</p>
          <p className="cal-day">launch</p>
          <p className="mini-wait">the senior is booked</p>
        </div>
        <div className="chair" aria-hidden="true">
          <span className="chair-back" />
          <span className="chair-seat" />
          <span className="chair-leg l" />
          <span className="chair-leg r" />
          <span className="chair-label">empty</span>
        </div>
        <div className="desk-pr">
          <p className="mini-kicker">{viz.cveKicker}</p>
          <p className="mini-title">last touched in March</p>
          <p>{viz.cvePr}</p>
          <span className="fail-mark">{viz.cveBuild}</span>
        </div>
      </div>
    </VizPanel>
  );
}
