// Median time per call over seven rounds: tinylinkify/linkify-it, the root
// and tinylinkify/gfm against linkify-it 5.0.2, on linkify-it's own benchmark
// samples, 52 chat messages, and about 100 KB of all of them, on the call
// markdown-it makes, `match` after a `pretest` that passes; and markdown-exit
// rendering the chat messages with each linkifier. The GFM entries find GFM's
// links, not linkify-it's, so theirs is the same work on the same text, not
// the same result.
// It measures the built dist/, what npm ships, building it first if it's
// stale, through scripts/dist-loader.ts; --source measures src/ instead.
// The two sides' rounds interleave, and which runs first alternates from
// round to round, so neither gains from going first.
// Usage: node bench/index.ts [--json] [--source]
import LinkifyIt from "linkify-it";
import MarkdownExit from "markdown-exit";
import { build } from "../scripts/dist.ts";
import { benchSamples } from "../scripts/shared.ts";

const source = process.argv.includes("--source");
if (!source) {
  build();
  // Imports of src/ below resolve to dist/ from here on.
  await import("../scripts/dist-loader.ts");
}
const root = await import("../src/index.ts");
const dropIn = (await import("../src/linkify-it/index.ts")).default;
const gfm = (await import("../src/gfm/index.ts")).default;

const samples = benchSamples();
let large = "";
for (let i = 0; large.length < 100 * 1024; i++) large += `${Object.values(samples)[i % 6]}\n\n`;
const inputs: Record<string, string> = { ...samples, large };

type Find = (text: string) => unknown;
const linkify =
  (l: { pretest(t: string): boolean; match(t: string): unknown }): Find =>
  (text) =>
    l.pretest(text) && l.match(text);
const render = (Linkify: new () => unknown): Find => {
  const md = MarkdownExit({ linkify: true }) as unknown as {
    linkify: unknown;
    render(s: string): string;
  };
  md.linkify = new Linkify();
  return (text) => md.render(text);
};

const pairs: [string, string, Record<string, string>, Find, Find][] = [
  ["linkify-it 5.0.2", "match", inputs, linkify(new LinkifyIt()), linkify(new dropIn())],
  [
    "linkify-it 5.0.2 (tinylinkify/gfm)",
    "match",
    inputs,
    linkify(new LinkifyIt()),
    linkify(new gfm()),
  ],
  ["linkify-it 5.0.2 (tinylinkify root)", "match", inputs, linkify(new LinkifyIt()), root.find],
  [
    "markdown-exit 1.3.0 (tinylinkify/linkify-it)",
    "render",
    { chat: samples.chat! },
    render(LinkifyIt as never),
    render(dropIn as never),
  ],
  [
    "markdown-exit 1.3.0 (tinylinkify/gfm)",
    "render",
    { chat: samples.chat! },
    render(LinkifyIt as never),
    render(gfm as never),
  ],
];

function time(fn: () => unknown): number {
  let iterations = 1;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    const elapsed = performance.now() - start;
    if (elapsed > 50) return elapsed / iterations;
    iterations *= 2;
  }
}

// Seven rounds of each, interleaved: round r times `theirs` first when r
// is even, `ours` first when it's odd. The medians.
function medians(theirs: () => unknown, ours: () => unknown) {
  const times: { theirs: number[]; ours: number[] } = { theirs: [], ours: [] };
  for (let round = 0; round < 7; round++)
    for (const side of round % 2 ? (["ours", "theirs"] as const) : (["theirs", "ours"] as const))
      times[side].push(time(side === "theirs" ? theirs : ours));
  const median = (list: number[]) => list.sort((a, b) => a - b)[3]!;
  return { theirs: median(times.theirs), ours: median(times.ours) };
}

const format = (ms: number) => (ms < 1 ? `${(ms * 1000).toFixed(1)} µs` : `${ms.toFixed(2)} ms`);

const rows: { library: string; operation: string; theirs: number; ours: number }[] = [];
for (const [library, op, texts, theirs, ours] of pairs)
  for (const [name, text] of Object.entries(texts))
    rows.push({
      library,
      operation: `${op} ${name}`,
      ...medians(
        () => theirs(text),
        () => ours(text),
      ),
    });

if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else {
  console.log(`tinylinkify from ${source ? "src/" : "the built dist/"}\n`);
  console.log(
    "| Library | Operation | Library time | tinylinkify | Speedup |\n| --- | --- | --: | --: | --: |",
  );
  for (const r of rows)
    console.log(
      `| ${r.library} | ${r.operation} | ${format(r.theirs)} | ${format(r.ours)} | ${(r.theirs / r.ours).toFixed(1)}x |`,
    );
}
