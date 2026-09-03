import { actors } from "../../copy";

type Active = "stage" | "crew" | "room" | "you";

const chips: { id: Active; label: string }[] = [
  { id: "stage", label: actors.stage.name },
  { id: "crew", label: actors.crew.name },
  { id: "room", label: "Room" },
  { id: "you", label: actors.you.name },
];

type Props = {
  active: Active;
};

export default function CastRail({ active }: Props) {
  return (
    <div className="cast-rail" aria-label={`Working now: ${chips.find((chip) => chip.id === active)?.label ?? ""}`}>
      {chips.map((chip) => (
        <span key={chip.id} className={`cast-chip ${chip.id === active ? "is-on" : ""}`}>
          <span className={`cast-dot ${chip.id}`} />
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function activeForFig(fig: string): Active {
  if (fig === "04" || fig === "09") return "stage";
  if (fig === "05") return "room";
  if (fig === "08") return "you";
  return "crew";
}
