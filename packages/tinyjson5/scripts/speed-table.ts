// Writes the Speed section's table, and the range in the sentence above it,
// into README.md and the website's size-and-speed page, from a run of
// `node bench/index.ts --json`. strip-json-comments only strips comments, so
// its rows say "strip" where the bench says "parse".
// Usage: node bench/index.ts --json > bench.json && node scripts/speed-table.ts bench.json
import { readFileSync, writeFileSync } from "node:fs";

type Row = { library: string; operation: string; theirs: number; ours: number };
const rows: Row[] = JSON.parse(readFileSync(process.argv[2]!, "utf8"));

const time = (ms: number) =>
  ms < 0.001
    ? `${(ms * 1e6).toFixed(0)} ns`
    : ms < 1
      ? `${(ms * 1000).toFixed(1)} µs`
      : `${ms.toFixed(2)} ms`;
const ratio = (r: Row) => r.theirs / r.ours;
const operation = (r: Row) =>
  r.library.startsWith("strip-json-comments")
    ? r.operation.replace(/^parse /, "strip ")
    : r.operation;

const table = [
  "| Original | Operation | Original | tinyjson5 | Speedup |",
  "| --- | --- | ---: | ---: | ---: |",
  ...rows.map(
    (r) =>
      `| ${r.library.replace(" (tinyjson5 root)", ", against the root")} | ${operation(r)} | ` +
      `${time(r.theirs)} | ${time(r.ours)} | ${ratio(r).toFixed(2)}× |`,
  ),
].join("\n");

const slowest = rows.reduce((a, b) => (ratio(a) < ratio(b) ? a : b));
const [verb, ...input] = operation(slowest).split(" ");
const range =
  `from ${ratio(slowest).toFixed(2)}× (${slowest.library.replace(/ [\d.]+( \(tinyjson5 root\))?$/, "")}'s ` +
  `\`${verb}\` of the ${input.join(" ")}) to ${Math.max(...rows.map(ratio)).toFixed(1)}×`;

for (const file of ["README.md", "../../docs/pages/tinyjson5/size-and-speed.md"]) {
  const text = readFileSync(file, "utf8")
    .replace(/from [\d.]+× \([^)]*\) to [\d.]+×/, range)
    .replace(/\| Original +\| Operation[^\n]*\n\| -+[^\n]*\n(\|[^\n]*\n)+/, `${table}\n`);
  writeFileSync(file, text);
}
console.log(range);
