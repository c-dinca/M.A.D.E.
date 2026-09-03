import { actors, viz } from "../../copy";
import Actor from "./Actor";
import RoomBox from "./RoomBox";
import VizPanel from "./VizPanel";

const states = ["recipe", "room", "patch", "verify", "call", "preview"];

export default function Afternoon() {
  return (
    <VizPanel kicker={viz.afternoonKicker} label="Stage Manager ticks the states. Crew types a patch. Packets bounce inside the Rehearsal Room.">
      <div className="afternoon">
        <div className="station">
          <div className="rack" aria-hidden="true">
            {states.map((state, index) => (
              <div className="rack-row" key={state} style={{ animationDelay: `${index * 1.15}s` }}>
                <span className="rack-led" />
                <span>{state}</span>
              </div>
            ))}
          </div>
          <p className="actor-name">{actors.stage.name}</p>
          <p className="actor-job">{actors.stage.job}</p>
        </div>
        <div className="station desk">
          <Actor kind="crew" name={actors.crew.name} job={actors.crew.job} working />
          <ul className="file-tick">
            {viz.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
        <div className="station">
          <RoomBox />
        </div>
      </div>
    </VizPanel>
  );
}
