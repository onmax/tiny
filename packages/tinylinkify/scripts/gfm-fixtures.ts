// The GFM comparisons on markdown: the autolink examples of the GFM spec, and
// the fixtures of micromark-extension-gfm-autolink-literal and
// mdast-util-gfm-autolink-literal, whose HTML is what github.com renders.
// Each goes through markdown-exit with tinylinkify/gfm as its linkifier, and
// the links it makes, URL and text, are compared with GitHub's, with
// remark-gfm's, and with those of markdown-exit on linkify-it 5. URLs are
// compared decoded, since each renderer percent-encodes its own way, and
// markdown-exit also writes hosts in punycode.
// Prints a line per suite and each case where tinylinkify/gfm and remark-gfm
// differ; --all prints every case where it differs from GitHub too.
// Usage: node scripts/gfm-fixtures.ts [--all] [--json]
import { readdirSync, readFileSync } from "node:fs";
import LinkifyIt from "linkify-it";
import Gfm from "../src/gfm/index.ts";
import { markdownExit, remarkLinks, type MarkdownLink } from "./remark.ts";

const gfm = markdownExit(Gfm as never);
const linkifyIt = markdownExit(LinkifyIt as never);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
const decodeHtml = (html: string) =>
  html.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name: string) =>
    name[0] === "#"
      ? String.fromCodePoint(
          name[1]!.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
        )
      : (ENTITIES[name] ?? whole),
  );
const decodeUrl = (url: string) => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

/** The links in rendered HTML: each `<a href>` with its text. */
const htmlLinks = (html: string): MarkdownLink[] =>
  [...html.matchAll(/<a [^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    url: decodeHtml(m[1]!),
    text: decodeHtml(m[2]!.replace(/<[^>]*>/g, "")),
  }));

const key = (links: MarkdownLink[], exit = false) =>
  links
    .map(({ url, text }) => `${decodeUrl(exit ? gfm.normalizeLinkText(url) : url)} | ${text}`)
    .join("\n");

interface Case {
  name: string;
  markdown: string;
  html: string;
}
const fixtures = (dir: string): Case[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({
      name: file.slice(0, -3),
      markdown: readFileSync(`${dir}/${file}`, "utf8"),
      html: readFileSync(`${dir}/${file.slice(0, -3)}.html`, "utf8"),
    }));

const SUITES: [string, Case[]][] = [
  [
    "GFM spec 0.29, autolinks",
    JSON.parse(readFileSync("test/suites/gfm-spec-0.29/autolinks.json", "utf8")).map(
      (c: { markdown: string; html: string }, i: number) => ({ name: `example ${i + 1}`, ...c }),
    ),
  ],
  [
    "micromark-extension-gfm-autolink-literal 2.1.0",
    fixtures("test/suites/micromark-extension-gfm-autolink-literal-2.1.0/fixtures"),
  ],
  [
    "mdast-util-gfm-autolink-literal 2.1.0",
    fixtures("test/suites/mdast-util-gfm-autolink-literal-2.1.0/fixture"),
  ],
];

const all = process.argv.includes("--all");
const results: Record<string, unknown>[] = [];
for (const [suite, cases] of SUITES) {
  const score = { cases: cases.length, github: 0, remark: 0, remarkGithub: 0, linkifyItGithub: 0 };
  const differ: string[] = [];
  for (const { name, markdown, html } of cases) {
    const github = key(htmlLinks(html));
    const remark = key(remarkLinks(markdown));
    const ours = key(gfm.links(markdown), true);
    const theirs = key(linkifyIt.links(markdown), true);
    score.github += +(ours === github);
    score.remark += +(ours === remark);
    score.remarkGithub += +(remark === github);
    score.linkifyItGithub += +(theirs === github);
    if (ours !== remark || (all && ours !== github)) {
      const lines = (text: string) => (text ? text.split("\n") : []);
      const [o, r, g] = [lines(ours), lines(remark), lines(github)];
      differ.push(
        `${name}:` +
          `\n  only tinylinkify/gfm: ${JSON.stringify(o.filter((l) => !r.includes(l)))}` +
          `\n  only remark-gfm:      ${JSON.stringify(r.filter((l) => !o.includes(l)))}` +
          (all ? `\n  github differs:       ${ours !== github}` : "") +
          (g.join() === r.join() ? "" : `\n  (remark-gfm differs from GitHub)`),
      );
    }
  }
  results.push({ suite, ...score });
  if (!process.argv.includes("--json")) {
    console.log(
      `${suite}: ${score.cases} cases. tinylinkify/gfm matches GitHub on ${score.github}, ` +
        `remark-gfm on ${score.remark}; remark-gfm matches GitHub on ${score.remarkGithub}, ` +
        `linkify-it 5 on ${score.linkifyItGithub}`,
    );
    for (const line of differ) console.log(`  ${line.replaceAll("\n", "\n  ")}`);
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
