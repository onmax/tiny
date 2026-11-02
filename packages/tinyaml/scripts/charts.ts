// Draws the README's charts from fresh measurements: bundle size
// (scripts/size.ts), speed (bench/index.ts) and correctness on the
// yaml-test-suite (scripts/correctness.ts). Each chart is a Markdown table
// that comark-charts turns into an SVG, written to .github/.
// Usage: [SIZE=<file>] [BENCH=<file>] node --no-warnings scripts/charts.ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseMarkdown } from "comark";
import charts from "comark-charts";

const run = (...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, ["--no-warnings", ...args, "--json"], { encoding: "utf8" }),
  );

const kib = (bytes: number) => (bytes / 1024).toFixed(1);
const row = (...cells: (string | number)[]) => `| ${cells.join(" | ")} |`;

// The family's colors (.github/scripts/brand.ts) for comark-charts' first two
// series: the first in 🤏's amber, with dark labels, the second in gray, with
// white ones. Each label goes with the bar its baseline sits in.
const SERIES: Record<string, [bar: string, label: string]> = {
  "#3b82f6": ["#faa700", "#110f0c"],
  "#f97316": ["#747474", "#ffffff"],
};
const brand = (svg: string) => {
  const bars = [...svg.matchAll(/<path d="M0,([\d.]+)L[^"]*" fill="(#[0-9a-f]{6})"/g)].map(
    ([, top, fill]) => ({ top: Number(top), fill: fill! }),
  );
  return svg
    .replace(/transform="translate\([\d.]+,([\d.]+)\)"[^>]* fill="#ffffff"/g, (text, y) => {
      const bar = bars.filter((b) => b.top < Number(y)).sort((a, b) => b.top - a.top)[0];
      return bar && SERIES[bar.fill] ? text.replace("#ffffff", SERIES[bar.fill]![1]) : text;
    })
    .replace(/#3b82f6|#f97316/g, (fill) => SERIES[fill]![0]);
};

async function draw(file: string, chart: string, table: string[]): Promise<void> {
  const { nodes, meta } = await parseMarkdown(`::chart{${chart}}\n${table.join("\n")}\n::\n`, {
    plugins: [charts()],
  });
  if (meta.issues.length) throw new Error(meta.issues.join("\n"));
  const json = JSON.stringify(nodes);
  const svg = JSON.parse(`"${json.slice(json.indexOf("<svg"), json.indexOf("</svg>") + 6)}"`);
  writeFileSync(`.github/${file}`, `${brand(svg)}\n`);
  console.log(`.github/${file}`);
}

const pairs = [
  ["js-yaml", "tinyaml/js-yaml", "js-yaml 4"],
  ["js-yaml 5", "tinyaml/js-yaml-v5", "js-yaml 5"],
  ["yaml", "tinyaml/yaml", "yaml"],
  ["@std/yaml", "tinyaml/std", "@std/yaml"],
  ["yamljs", "tinyaml/yamljs", "yamljs"],
] as const;
// Each row names the subpath that replaces the library, so a reader knows
// which import the numbers belong to.
const label = (ours: string, theirs: string) => `${ours} vs ${theirs}`;

// SIZE=<file> reuses a saved `node scripts/size.ts --json` run, as BENCH does
// below: gzip sizes shift about 1% with the zlib Node is built with.
const size: Record<string, { gzip: number }> = process.env.SIZE
  ? JSON.parse(readFileSync(process.env.SIZE, "utf8"))
  : run("scripts/size.ts");
await draw("size.svg", 'horizontal labels title="Bundle size, KiB gzip"', [
  row("library", "tinyaml", "original"),
  row("---", "--:", "--:"),
  ...pairs.map(([, ours, theirs]) =>
    row(label(ours, theirs), kib(size[ours]!.gzip), kib(size[theirs]!.gzip)),
  ),
]);

// BENCH=<file> reuses a saved `node bench/index.ts --json` run, so the chart
// and a table printed from that file show the same numbers.
const bench: { library: string; operation: string; theirs: number; tinyaml: number }[] = process.env
  .BENCH
  ? JSON.parse(readFileSync(process.env.BENCH, "utf8"))
  : run("bench/index.ts");
const speedup = (library: string, operation: string) => {
  const r = bench.find((r) => r.library === library && r.operation === operation)!;
  return (r.theirs / r.tinyaml).toFixed(1);
};
await draw("speed.svg", 'horizontal labels title="Times faster than the original, 268 KiB file"', [
  row("library", "parse", "stringify"),
  row("---", "--:", "--:"),
  ...pairs.map(([name, ours, theirs]) =>
    row(label(ours, theirs), speedup(name, "parse large"), speedup(name, "stringify large")),
  ),
]);

const scores: Record<
  string,
  {
    valid: number;
    validRight: number;
    unknownTag: number;
    invalid: number;
    invalidRejected: number;
  }
> = run("scripts/correctness.ts");
const percent = (part: number, whole: number) => ((part / whole) * 100).toFixed(1);
// Valid cases a library refuses only for an unknown tag are left out of its
// share; the README says how many there were. yamljs is scored on
// single-document cases only.
await draw("correctness.svg", 'horizontal labels title="yaml-test-suite cases right, %"', [
  row("library", "valid YAML read right", "invalid YAML rejected"),
  row("---", "--:", "--:"),
  ...Object.entries(scores).map(([name, s]) =>
    row(
      name === "yamljs" ? "yamljs, one document" : name,
      percent(s.validRight, s.valid - s.unknownTag),
      percent(s.invalidRejected, s.invalid),
    ),
  ),
]);
