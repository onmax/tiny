// Measures every drop-in next to the library it replaces and writes
// .github/drop-ins.json: gzip bytes, and median ms to parse and stringify each
// package's large benchmark file. The numbers come from each package's own
// scripts/size.ts and bench/index.ts, run with --json. automd.config.ts turns
// the file into the tables in the READMEs.
// Name packages to measure only theirs: the other rows stay as they are, and
// rows measured on another machine than the file's say which.
// Usage: node --no-warnings .github/scripts/drop-ins.ts [package...]
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { readDropIns, type Comparison, type DropIns } from "../../automd.config.ts";

const only = process.argv.slice(2);
const measure = (pkg: string) => !only.length || only.includes(pkg);
const previous = existsSync(".github/drop-ins.json") ? readDropIns() : undefined;
const machine = `${cpus()[0]!.model.trim()}, Node ${process.versions.node}`;

// A script may log a build first, so the JSON starts at the first line that is
// only "{" or "[".
const run = (pkg: string, script: string) => {
  const out = execFileSync(process.execPath, ["--no-warnings", script, "--json"], {
    cwd: `packages/${pkg}`,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out.slice(out.search(/^[[{]$/m)));
};

type Sizes = Record<string, { gzip: number }>;
type Rows = { operation: string; theirs: number; ours?: number; tinyaml?: number; library?: string }[];

// A package's sizes and timings, or nothing when it isn't being measured.
const numbers = (pkg: string): [Sizes, Rows] =>
  measure(pkg) ? [run(pkg, "scripts/size.ts"), run(pkg, "bench/index.ts")] : [{}, []];
const [yamlSize, yamlBench] = numbers("tinyaml");
const [json5Size, json5Bench] = numbers("tinyjson5");
const [iniSize, iniBench] = numbers("tinyini");
const [linkSize, linkBench] = numbers("tinylinkify");

const timing = (rows: Rows, operation: string, library?: string) => {
  const r = rows.find((r) => r.operation === operation && (!library || r.library === library));
  return r && { theirs: r.theirs, ours: r.ours ?? r.tinyaml! };
};
const compare = (
  pkg: string,
  library: string,
  entry: string,
  sizes: Sizes,
  [theirs, ours]: [string, string],
  rows: Rows,
  benchLibrary?: string,
  // What "parse" is for this package's bench: linkify-it's is `match`.
  parse = "parse large",
): Comparison => {
  if (!measure(pkg)) {
    const kept = [...(previous?.dropIns ?? []), previous?.root, ...(previous?.roots ?? [])].find(
      (r) => r?.entry === entry && r.library === library,
    );
    if (!kept) throw new Error(`${entry} has no row in .github/drop-ins.json; measure ${pkg}`);
    return { ...kept, machine: kept.machine ?? previous!.machine };
  }
  return {
    package: pkg,
    library,
    entry,
    gzip: { theirs: sizes[theirs]!.gzip, ours: sizes[ours]!.gzip },
    parse: timing(rows, parse, benchLibrary)!,
    // A library that only parses, such as strip-json-comments, has no stringify row.
    stringify: timing(rows, "stringify large", benchLibrary),
    machine,
  };
};
const yaml = (library: string, entry: string, size: string, bench: string) =>
  compare("tinyaml", library, entry, yamlSize, [size, entry], yamlBench, bench);
const ini = (library: string, entry: string, bench = library) =>
  compare("tinyini", library, entry, iniSize, [library, entry], iniBench, bench);

const data: DropIns = {
  machine,
  dropIns: [
    yaml("js-yaml 4", "tinyaml/js-yaml", "js-yaml 4", "js-yaml"),
    yaml("js-yaml 5", "tinyaml/js-yaml-v5", "js-yaml 5", "js-yaml 5"),
    yaml("yaml 2", "tinyaml/yaml", "yaml", "yaml"),
    yaml("yamljs", "tinyaml/yamljs", "yamljs", "yamljs"),
    yaml("@std/yaml", "tinyaml/std", "@std/yaml", "@std/yaml"),
    // Each tinyjson5 subpath, by the names its size.ts and bench/index.ts use.
    ...(
      [
        ["json5 2.2.3", "tinyjson5/json5"],
        ["json5 1.0.2", "tinyjson5/json5-v1"],
        ["strip-json-comments 3", "tinyjson5/strip-json-comments"],
        ["strip-json-comments 2", "tinyjson5/strip-json-comments-v2"],
        ["strip-json-comments 5", "tinyjson5/strip-json-comments-v5"],
        ["jsonc-parser 3.3.1", "tinyjson5/jsonc-parser"],
        ["comment-json 4.6.2", "tinyjson5/comment-json"],
        ["jju 1.4.0", "tinyjson5/jju"],
      ] as const
    ).map(([library, entry]) =>
      compare("tinyjson5", library, entry, json5Size, [library, entry], json5Bench, library),
    ),
    ini("ini 7.0.0", "tinyini/ini"),
    ini("ini 2.0.0", "tinyini/ini-v2"),
    ini("ini 1.3.8", "tinyini/ini-v1"),
    ini("@one-ini/wasm 0.2.1", "tinyini/one-ini"),
    ini("@one-ini/wasm 0.1.1", "tinyini/one-ini-v0.1"),
    compare(
      "tinylinkify",
      "linkify-it 5.0.2",
      "tinylinkify/linkify-it",
      linkSize,
      ["linkify-it 5.0.2", "tinylinkify/linkify-it"],
      linkBench,
      "linkify-it 5.0.2",
      "match large",
    ),
  ],
  root: yaml("yaml 2", "tinyaml", "yaml", "yaml (tinyaml root)"),
  // The other packages' own APIs, each against the library its users switch from.
  roots: [
    compare(
      "tinyjson5",
      "json5 2.2.3",
      "tinyjson5",
      json5Size,
      ["json5 2.2.3", "tinyjson5"],
      json5Bench,
      "json5 2.2.3 (tinyjson5 root)",
    ),
    ini("ini 7.0.0", "tinyini", "ini 7.0.0 (tinyini root)"),
    compare(
      "tinylinkify",
      "linkify-it 5.0.2",
      "tinylinkify",
      linkSize,
      ["linkify-it 5.0.2", "tinylinkify"],
      linkBench,
      "linkify-it 5.0.2 (tinylinkify root)",
      "match large",
    ),
  ],
};
// The file's machine is the one most rows were measured on; rows from it
// don't repeat it.
const rows = [...data.dropIns, data.root, ...data.roots!];
const tally = new Map<string, number>();
for (const r of rows) tally.set(r.machine!, (tally.get(r.machine!) ?? 0) + 1);
data.machine = [...tally].sort((a, b) => b[1] - a[1])[0]![0];
for (const r of rows) if (r.machine === data.machine) delete r.machine;

writeFileSync(".github/drop-ins.json", `${JSON.stringify(data, null, 2)}\n`);
console.log(".github/drop-ins.json");
