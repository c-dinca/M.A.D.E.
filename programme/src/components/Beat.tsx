import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import Afternoon from "./viz/Afternoon";
import CheapHalf from "./viz/CheapHalf";
import EmptyDesk from "./viz/EmptyDesk";

const visuals: Record<string, ReactNode> = {
  "01": <EmptyDesk />,
  "02": <CheapHalf />,
  "03": <Afternoon />,
};

type Props = {
  fig: string;
  title: string;
  body: string;
};

export default function Beat({ fig, title, body }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className={`beat ${fig === "02" ? "beat-flip" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="beat-copy">
        <p className="fig">Fig {fig}</p>
        <h2>{title}</h2>
        <p className="lede">{body}</p>
      </div>
      <div className="beat-viz">{visuals[fig]}</div>
    </motion.section>
  );
}
