import { motion, useReducedMotion } from "framer-motion";

type Props = {
  fig: string;
  title: string;
  body: string;
};

export default function Beat({ fig, title, body }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className="beat"
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="fig">Fig {fig}</p>
      <h2>{title}</h2>
      <p className="lede">{body}</p>
    </motion.section>
  );
}
