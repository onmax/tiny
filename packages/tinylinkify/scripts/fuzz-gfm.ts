// Differential fuzzing of tinylinkify's GFM links against remark-gfm's
// autolink literal step (scripts/remark.ts), on plain text: lines of the
// micromark and mdast fixtures, the benchmark samples and some chat, each
// edited a few times with the pieces the GFM rules care about. Both must find
// the same links, at the same offsets, with the same URLs; the root, the
// /gfm entry's match, and its matchAtStart on each link with a schema too.
// Inputs are single lines with nothing to trim at the ends, which is what a
// run of text is, and no U+0000, which micromark reads as U+FFFD.
// Usage: node scripts/fuzz-gfm.ts [iterations] [seed]
import { readdirSync, readFileSync } from "node:fs";
import LinkifyIt from "../src/gfm/index.ts";
import { find } from "../src/index.ts";
import { autolinks } from "./remark.ts";
import { benchSamples, count, seeded, show } from "./shared.ts";

const iterations = count(2, 20000);
const next = seeded(count(3, 1));
const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!;
const int = (n: number) => Math.floor(next() * n);

const SUITES = [
  "test/suites/micromark-extension-gfm-autolink-literal-2.1.0/fixtures",
  "test/suites/mdast-util-gfm-autolink-literal-2.1.0/fixture",
];
const lines = (text: string) => text.split(/\r?\n/);
const seeds = [
  ...SUITES.flatMap((dir) =>
    readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .flatMap((file) => lines(readFileSync(`${dir}/${file}`, "utf8"))),
  ),
  ...Object.values(benchSamples()).flatMap(lines),
].filter((line) => line.trim());

const pieces = [
  "www.",
  "WWW.",
  "wWw.",
  "http://",
  "https://",
  "HTTPS://",
  "httpx://",
  "ftp://",
  "mailto:",
  "xmpp:",
  "@",
  ".",
  "..",
  "_",
  "-",
  "+",
  "(",
  ")",
  "))",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  "&",
  "&amp;",
  "&hl;",
  "&#35;",
  ";",
  ":",
  "/",
  "?",
  "!",
  "*",
  "~",
  '"',
  "'",
  ",",
  "#",
  "%",
  "=",
  "`",
  "\\",
  "|",
  "$",
  " ",
  "\t",
  "\u000b",
  "\u000c",
  "\u0085",
  " ",
  " ",
  "　",
  "﻿",
  "\u001f",
  "\u007f",
  "a",
  "Z",
  "1",
  "é",
  "ß",
  "點看",
  "пример",
  "😀",
  "\ud800",
  "\udc00",
  "«",
  "»",
  "。",
  "“",
  "”",
  "–",
  "…",
  "€",
  "©",
  ".com",
  ".org",
  ".c_d",
  "a_b.",
  "example",
  "a@b.co",
  "a.b-c_d@a.b",
  "/resource",
  "/a.b",
  "?q=(x)",
];

function mutate(text: string): string {
  const edits = 1 + int(4);
  for (let i = 0; i < edits; i++) {
    const at = int(text.length + 1);
    switch (int(5)) {
      case 0:
      case 1:
        text = text.slice(0, at) + pick(pieces) + text.slice(at);
        break;
      case 2:
        text = text.slice(0, at) + text.slice(at + 1 + int(4));
        break;
      case 3:
        text = text.slice(0, at) + pick(pieces) + text.slice(at + 1 + int(3));
        break;
      default: {
        const from = int(text.length);
        text = text.slice(0, at) + text.slice(from, from + int(12)) + text.slice(at);
      }
    }
  }
  return text;
}

// A single line with nothing to trim at either end: what remark keeps of a paragraph.
const plain = (text: string) =>
  text
    .replace(/[\n\r\0]/g, " ")
    .replace(/^[ \t]+|[ \t]+$/g, "")
    .replace(/^(\s)+/u, "");

const linkify = new LinkifyIt();
let checked = 0;
let differences = 0;
let links = 0;
const examples: string[] = [];
for (let i = 0; i < iterations; i++) {
  let text = pick(seeds);
  if (next() < 0.2) text += pick([" ", ", ", ""]) + pick(seeds);
  if (next() < 0.9) text = mutate(text);
  text = plain(text);
  if (!text) continue;
  let want;
  try {
    want = JSON.stringify(autolinks(text));
  } catch {
    continue;
  }
  checked++;
  const found = find(text);
  links += found.length;
  const got = JSON.stringify(found.map(({ index, lastIndex, url }) => ({ index, lastIndex, url })));
  const matched = linkify.match(text) ?? [];
  const fromEntry = JSON.stringify(
    matched.map(({ index, lastIndex, url }: { index: number; lastIndex: number; url: string }) => ({
      index,
      lastIndex,
      url,
    })),
  );
  // matchAtStart from each http(s) link the root finds that micromark would
  // read, which is what markdown-exit asks for at `://`.
  const atStart = found.filter(
    (link) =>
      /^https?:$/.test(link.schema) &&
      linkify.matchAtStart(text.slice(link.index))?.text !== link.text,
  );
  const textsOk = found.every((link) => text.slice(link.index, link.lastIndex) === link.text);
  if (got !== want || fromEntry !== want || !textsOk) {
    differences++;
    if (examples.length < Number(process.env.SHOW ?? 10))
      examples.push(
        `${show(text)}\n  remark ${want}\n  ours   ${got}${fromEntry === got ? "" : `\n  /gfm   ${fromEntry}`}`,
      );
  } else if (atStart.length) {
    // A link micromark found at the start must come back from matchAtStart;
    // one only the mdast search found may not, as micromark doesn't link it.
    const missed = atStart.filter((link) => {
      const start = linkify.matchAtStart(text.slice(link.index));
      return start && start.text !== link.text;
    });
    if (missed.length) {
      differences++;
      if (examples.length < Number(process.env.SHOW ?? 10))
        examples.push(
          `${show(text)}: matchAtStart differs at ${missed.map((l) => l.index).join(", ")}`,
        );
    }
  }
}
for (const example of examples) console.log(example);
console.log(`${checked} inputs, ${links} links: ${differences} differ from remark-gfm`);
process.exitCode = differences ? 1 : 0;
