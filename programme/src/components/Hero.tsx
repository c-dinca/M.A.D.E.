import { motion, useReducedMotion } from "framer-motion";
import { hero } from "../copy";
import Wordmark from "./Wordmark";

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="hero" id="top">
      <div className="hero-inner">
        <motion.p
          className="hero-brand"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Wordmark size="hero" />
        </motion.p>
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
    </section>
  );
}
