import { viz } from "../../copy";
import VizPanel from "./VizPanel";

function House({ lit, label }: { lit?: boolean; label: string }) {
  return (
    <div className={`house ${lit ? "is-lit" : "is-dim"}`}>
      <div className="roof" aria-hidden="true" />
      <div className="face" aria-hidden="true">
        <span className="win" />
        <span className="win" />
        <span className="win" />
        <span className="win" />
      </div>
      <p>{label}</p>
    </div>
  );
}

export default function Houses() {
  return (
    <VizPanel label="Three Houses. Only yours is lit. No shared database row.">
      <div className="street">
        <House label={viz.houseOther} />
        <span className="wall">{viz.wall}</span>
        <House lit label={viz.houseYours} />
        <span className="wall">{viz.wall}</span>
        <House label={viz.houseOther} />
      </div>
    </VizPanel>
  );
}
