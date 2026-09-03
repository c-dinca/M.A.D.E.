import { motion, useReducedMotion } from "framer-motion";
import { promptBook, promptLines } from "../copy";

export default function PromptBook() {
  const reduce = useReducedMotion();

  return (
    <figure className="prompt-book">
      <figcaption>{promptBook.caption}</figcaption>
      <div className="log" role="log" aria-label="Illustrated Prompt Book excerpt">
        {promptLines.map((line, index) => (
          <motion.div
            className="prompt-line"
            key={`${line.ts}-${line.event}`}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 0.28,
              delay: reduce ? 0 : 0.12 + index * 0.11,
              ease: "easeOut",
            }}
          >
            <span className="ts">{line.ts}</span>
            <span>{line.event}</span>
            <span className={`detail${line.mark ? ` ${line.mark}` : ""}`}>
              {line.detail ?? ""}
            </span>
          </motion.div>
        ))}
        <motion.span
          className="cursor"
          aria-hidden="true"
          initial={reduce ? { opacity: 0 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: reduce ? 0 : 0.12 + promptLines.length * 0.11 }}
        />
      </div>
    </figure>
  );
}
