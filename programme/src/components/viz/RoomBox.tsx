import { viz } from "../../copy";

type Props = {
  compact?: boolean;
};

export default function RoomBox({ compact }: Props) {
  return (
    <div className={`room ${compact ? "room-compact" : ""}`}>
      <div className="room-wall">
        <p className="room-title">{viz.roomTitle}</p>
        <p className="room-meta">{viz.roomMeta}</p>
        <span className="packet p1" aria-hidden="true" />
        <span className="packet p2" aria-hidden="true" />
        <span className="packet p3" aria-hidden="true" />
        <div className="room-core">suite</div>
      </div>
      {compact ? null : <p className="room-caption">{viz.packets}</p>}
    </div>
  );
}
