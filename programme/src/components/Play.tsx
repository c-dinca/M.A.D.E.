import { useReducedMotion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRef, useState } from "react";
import { play } from "../copy";
import Frame from "./Frame";

export default function Play() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const last = play.steps.length - 1;
    const next = Math.min(last, Math.max(0, Math.round(value * last)));
    setIndex(next);
  });

  const step = play.steps[index];
  if (!step) {
    return null;
  }

  if (reduce) {
    return (
      <section className="play play-static">
        <p className="fig play-kicker">{play.kicker}</p>
        {play.steps.map((item) => (
          <div className="play-row" key={item.fig}>
            <div className="play-copy">
              <p className="fig">Fig {item.fig}</p>
              <h2>{item.title}</h2>
              <p className="lede">{item.body}</p>
            </div>
            <Frame step={item} />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="play" ref={ref}>
      <div className="play-pin">
        <div className="play-progress" style={{ width: `${((index + 1) / play.steps.length) * 100}%` }} />
        <div className="play-grid">
          <div className="play-copy">
            <p className="fig">{play.kicker}</p>
            <p className="fig">Fig {step.fig}</p>
            <h2>{step.title}</h2>
            <p className="lede">{step.body}</p>
          </div>
          <Frame step={step} />
        </div>
      </div>
    </section>
  );
}
