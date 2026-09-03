import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import Spread from "./Spread";

type Props = {
  id: string;
  rail: string;
  wide?: boolean;
  children: ReactNode;
};

export default function Act({ id, rail, wide, children }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className="act"
      id={id}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <Spread rail={rail} wide={wide}>
        {children}
      </Spread>
    </motion.section>
  );
}
