import type { ReactNode } from "react";

type Props = {
  label: string;
  kicker?: string;
  paper?: boolean;
  children: ReactNode;
};

export default function VizPanel({ label, kicker, paper, children }: Props) {
  return (
    <div className={`viz ${paper ? "viz-paper" : "viz-dark"}`} role="img" aria-label={label}>
      {kicker ? <p className="viz-kicker">{kicker}</p> : null}
      {children}
    </div>
  );
}
