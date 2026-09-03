import { motion, useReducedMotion } from "framer-motion";
import { lanes } from "../copy";

export default function Lanes() {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className="lanes"
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="fig">Fig {lanes.fig}</p>
      <h2>{lanes.title}</h2>
      <div className="lane-grid">
        <article>
          <p className="lane-kicker">{lanes.verified.kicker}</p>
          <h3>{lanes.verified.question}</h3>
          <p>{lanes.verified.body}</p>
        </article>
        <article>
          <p className="lane-kicker">{lanes.judgement.kicker}</p>
          <h3>{lanes.judgement.question}</h3>
          <p>{lanes.judgement.body}</p>
        </article>
      </div>
    </motion.section>
  );
}
