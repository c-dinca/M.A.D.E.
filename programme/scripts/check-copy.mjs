import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const banned = ["\u2014", "\u2013"];
const bannedWords = [
  "leverage",
  "seamless",
  "unlock",
  "empower",
  "revolutionise",
  "revolutionize",
  "supercharge",
  "effortless",
  "cutting-edge",
  "game-changing",
  "AI-powered",
  "not built",
  "not finished",
  "no code yet",
  "haven't shipped",
  "have not shipped",
  "nothing has run",
  "i made this up",
  "tbd",
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (/\.(tsx|ts|css|html|mjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

let failed = 0;
for (const file of walk(join(root, "src")).concat([
  join(root, "index.html"),
])) {
  const text = readFileSync(file, "utf8");
  for (const mark of banned) {
    if (text.includes(mark)) {
      console.error(`${file}: contains a dash that should not be there`);
      failed += 1;
    }
  }
  if (file.endsWith("copy.ts") || file.endsWith(".tsx")) {
    for (const word of bannedWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        console.error(`${file}: banned word "${word}"`);
        failed += 1;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("copy check passed: no em dashes, no en dashes, no banned words");
