// Bundles each entry the way a consumer's build would, with esbuild
// (minified ESM), and prints minified and gzip -9 sizes in KiB (1,024
// bytes), tinylinkify's next to linkify-it 5.0.2. tinylinkify's entries are
// the built dist/ that npm ships, built first when src/ is newer. --json
// prints bytes.
//
// It fails the run when an entry doesn't build, outgrows its BUDGET, is
// bigger than linkify-it, holds another entry's code, or isn't bigger than
// the root, and when a package specifier loads an entry that doesn't behave
// as its own.
// Usage: node scripts/size.ts [--json]
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build, ENTRIES } from "./dist.ts";

// Each entry, with its named exports and its default export, then the
// library it replaces or stands beside, which it must not outgrow.
const entries: [string, string, string?][] = [
  ["tinylinkify", "index", "linkify-it 5.0.2"],
  ["tinylinkify/gfm", "gfm", "linkify-it 5.0.2"],
  ["tinylinkify/linkify-it", "linkify-it", "linkify-it 5.0.2"],
  ["  linkify-it 5.0.2", "export { default } from 'linkify-it'"],
  // What markdown-it 15 and markdown-exit 2 use, for comparison.
  ["  linkify-it 6.1.0", "export { LinkifyIt } from 'linkify-it-v6'"],
];

// Gzip bytes each entry may reach, about 30 over its size when last set.
// Raise one on purpose, and say why in the commit.
const BUDGET: Record<string, number> = {
  tinylinkify: 1870,
  "tinylinkify/gfm": 2300,
  "tinylinkify/linkify-it": 4030,
};

// Code each entry must hold, as it reads once minified, and code it must
// not: linkify-it's sources in the GFM entries, or the GFM search in the
// drop-in, would mean one entry bundles the other.
const MARKERS: [string, string[]][] = [
  ["src_ZPCc", ["tinylinkify/linkify-it"]],
  ["xmpp:", ["tinylinkify", "tinylinkify/gfm"]],
  ["matchAtStart", ["tinylinkify/gfm", "tinylinkify/linkify-it"]],
];

// What each package specifier must do, through package.json's exports.
const SPECIFIERS: [string, (lib: any) => boolean][] = [
  ["tinylinkify", (lib) => lib.find("see www.example.com")[0]?.url === "http://www.example.com"],
  [
    "tinylinkify/gfm",
    (lib) => new lib.default().match("see www.example.com")?.[0]?.url === "http://www.example.com",
  ],
  [
    "tinylinkify/linkify-it",
    (lib) =>
      lib.default().match("see example.com")?.[0]?.url === "http://example.com" &&
      typeof lib.default().re.src_ZPCc === "string",
  ],
];

build();

/** Every export of a built entry, its default export included when it has one. */
const whole = (file: string) =>
  `export * from ${JSON.stringify(file)};` +
  (/\bas default\b/.test(readFileSync(file, "utf8"))
    ? ` export { default } from ${JSON.stringify(file)};`
    : "");

const json: Record<string, { min: number; gzip: number }> = {};
const kib = (bytes: number) => `${(bytes / 1024).toFixed(2)} KiB`;
const problems: string[] = [];
for (const [name, source, original] of entries) {
  const built = ENTRIES[source];
  let code: Uint8Array;
  try {
    code = buildSync({
      stdin: { contents: built ? whole(built) : source, resolveDir: process.cwd(), loader: "ts" },
      bundle: true,
      minify: true,
      format: "esm",
      platform: "neutral",
      mainFields: ["module", "main"],
      logLevel: "silent",
      write: false,
    }).outputFiles[0]!.contents;
  } catch (error) {
    problems.push(`${name.trim()} does not build:\n${(error as Error).message}`);
    continue;
  }
  const size = { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
  json[name.trim()] = size;
  if (!process.argv.includes("--json"))
    console.log(
      `${name.padEnd(24)} ${kib(size.min).padStart(10)} min ${kib(size.gzip).padStart(10)} gzip`,
    );
  if (!built) continue;
  if (size.gzip > BUDGET[name]!)
    problems.push(`${name} is ${size.gzip} B gzip, over its budget of ${BUDGET[name]} B`);
  const text = new TextDecoder().decode(code);
  for (const [marker, holders] of MARKERS)
    if (text.includes(marker) !== holders.includes(name))
      problems.push(
        `${name} ${text.includes(marker) ? "holds" : "lacks"} ${JSON.stringify(marker)}`,
      );
  if (original) (json[name] as { original?: string } & typeof size).original = original;
}
for (const [name, size] of Object.entries(json)) {
  const original = (size as { original?: string }).original;
  const theirs = original && json[original];
  if (theirs && size.gzip > theirs.gzip)
    problems.push(`${name} is ${size.gzip} B gzip, bigger than ${original} at ${theirs.gzip} B`);
  delete (size as { original?: string }).original;
}
// The root is the GFM search alone, so it must be the smallest entry.
for (const name of Object.keys(BUDGET))
  if (
    name !== "tinylinkify" &&
    json[name] &&
    json.tinylinkify &&
    json[name].gzip <= json.tinylinkify.gzip
  )
    problems.push(
      `${name} is ${json[name].gzip} B gzip, no bigger than the root at ${json.tinylinkify.gzip} B`,
    );
const exported = Object.keys(JSON.parse(readFileSync("package.json", "utf8")).exports)
  .filter((key) => key !== "./package.json")
  .map((key) => `tinylinkify${key.slice(1)}`);
for (const specifier of exported)
  if (!SPECIFIERS.some(([s]) => s === specifier))
    problems.push(`${specifier} is exported but has no check in SPECIFIERS`);
for (const [specifier, works] of SPECIFIERS)
  if (!works(await import(specifier))) problems.push(`${specifier} doesn't load its own entry`);
if (process.argv.includes("--json")) console.log(JSON.stringify(json, null, 2));
for (const problem of problems) console.error(problem);
if (problems.length) process.exitCode = 1;
