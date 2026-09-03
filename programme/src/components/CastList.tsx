import { motion, useReducedMotion } from "framer-motion";

type Row = {
  role: string;
  duty: string;
};

type Props = {
  rows: Row[];
  delay?: number;
};

export default function CastList({ rows, delay = 0 }: Props) {
  const reduce = useReducedMotion();

  return (
    <div className="cast">
      {rows.map((row, index) => (
        <div className="cast-row" key={row.role}>
          <span className="role">{row.role}</span>
          <motion.span
            className="leaders"
            aria-hidden="true"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{
              duration: 0.7,
              delay: delay + index * 0.045,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
          <span className="duty">{row.duty}</span>
        </div>
      ))}
    </div>
  );
}
