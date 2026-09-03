import type { ReactNode } from "react";

type Props = {
  rail: string;
  wide?: boolean;
  children: ReactNode;
};

export default function Spread({ rail, wide, children }: Props) {
  return (
    <div className="spread">
      <p className="rail">{rail}</p>
      <div className={wide ? "copy wide" : "copy"}>{children}</div>
    </div>
  );
}
