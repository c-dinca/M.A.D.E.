import { motion, useReducedMotion } from "framer-motion";
import { close, instance } from "../copy";
import Wordmark from "./Wordmark";
import Houses from "./viz/Houses";
import StageClose from "./viz/StageClose";

export default function Close() {
  const reduce = useReducedMotion();

  return (
    <>
      <motion.section
        className="instance"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="instance-copy">
          <p className="fig">Fig {instance.fig}</p>
          <h2>{instance.title}</h2>
          <p className="lede">{instance.body}</p>
        </div>
        <div className="instance-viz">
          <Houses />
        </div>
      </motion.section>
      <section className="close">
        <StageClose />
        <div className="close-copy">
          <h2>{close.title}</h2>
          <p className="tag">{close.tag}</p>
          <p className="note">{close.note}</p>
          <Wordmark />
        </div>
      </section>
    </>
  );
}
