import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { PointerEvent } from "react";
import { cover } from "../copy";

export default function Cover() {
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 40, damping: 18, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 40, damping: 18, mass: 0.6 });
  const shiftX = useTransform(x, (v) => v * 14);
  const shiftY = useTransform(y, (v) => v * 10);

  function onMove(event: PointerEvent<HTMLElement>) {
    if (reduce) return;
    const box = event.currentTarget.getBoundingClientRect();
    rawX.set((event.clientX - box.left) / box.width - 0.5);
    rawY.set((event.clientY - box.top) / box.height - 0.5);
  }

  function onLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <header className="house" onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        className="house-glow"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.4, ease: "easeOut" }}
      />
      <div className="grain" />
      <motion.div
        className="spread"
        style={reduce ? undefined : { x: shiftX, y: shiftY }}
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="rail">{cover.rail}</p>
        <div className="copy">
          <h1 className="wordmark" aria-label="scenio">
            scen
            <span className="i">
              ı
              <motion.span
                className="dot"
                aria-hidden="true"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            o
          </h1>
          <motion.hr
            className="rule-amber"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <p className="bill">{cover.bill}</p>
          <p className="house-foot">{cover.foot}</p>
        </div>
      </motion.div>
    </header>
  );
}
