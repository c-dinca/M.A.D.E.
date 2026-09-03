import { actors, viz } from "../../copy";
import Actor from "./Actor";
import VizPanel from "./VizPanel";

type Props = {
  waiting?: boolean;
};

export default function CveGraph({ waiting }: Props) {
  return (
    <VizPanel
      kicker={viz.cveKicker}
      label="A lockfile tree. A high advisory sits on protobuf, pulled in through three packages. The build is red."
    >
      <div className="cve">
        <svg className="cve-lines" viewBox="0 0 360 220" aria-hidden="true">
          <path d="M180 28 L180 58" />
          <path d="M180 58 L70 92" />
          <path d="M180 58 L180 92" />
          <path d="M180 58 L290 92" />
          <path d="M70 128 L70 158" />
          <path d="M180 128 L70 158" />
          <path d="M290 128 L70 158" />
        </svg>
        <span className="node root" style={{ top: "0.2rem", left: "50%" }}>
          {viz.cveRoot}
        </span>
        <span className="node" style={{ top: "6.4rem", left: "20%" }}>
          grpcio
        </span>
        <span className="node" style={{ top: "6.4rem", left: "50%" }}>
          google-api
        </span>
        <span className="node" style={{ top: "6.4rem", left: "80%" }}>
          billing
        </span>
        <span className="node leaf hot" style={{ top: "12.2rem", left: "20%" }}>
          protobuf 3.20.1
          <span className="cve-tag">CVE</span>
        </span>
      </div>
      <div className="cve-pr">
        <span>{viz.cvePr}</span>
        <span className="fail-mark">{viz.cveBuild}</span>
      </div>
      {waiting ? (
        <div className="cve-wait">
          <Actor kind="crew" name={actors.crew.name} job={actors.crew.job} compact />
          <p className="cve-caption">{viz.cveCaption}</p>
        </div>
      ) : (
        <p className="cve-caption">{viz.cveCaption}</p>
      )}
    </VizPanel>
  );
}
