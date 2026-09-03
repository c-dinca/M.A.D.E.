import { motion, useReducedMotion } from "framer-motion";
import { hero } from "../copy";
import CveGraph from "./viz/CveGraph";

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="hero" id="top">
      <div className="hero-inner">
        <div className="hero-copy">
          <motion.h1
            className="hero-line"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {hero.line}
          </motion.h1>
          <motion.p
            className="hero-sub"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {hero.sub}
          </motion.p>
        </div>
        <motion.div
          className="hero-viz"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <CveGraph />
        </motion.div>
      </div>
    </section>
  );
}
