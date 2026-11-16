#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { createTwoFilesPatch } from "diff";
import pc from "picocolors";
import { gitChanges, packageManager, scan, type Found } from "./detect.ts";
import { byName, type Tiny } from "./libraries.ts";
import { apply, plan, type Plan } from "./migrate.ts";

const USAGE = `Usage: tinyswap [dir] [options]

Moves a project from js-yaml, yaml, yamljs, @std/yaml, json5,
strip-json-comments, jsonc-parser, comment-json, jju, ini, @one-ini/wasm and
linkify-it to the tinyaml, tinyjson5, tinyini and tinylinkify drop-ins: it
rewrites their imports and swaps the dependencies in package.json. dir
defaults to the current directory.

Options:
  --yes            Migrate everything found without asking
  --dry-run        Print the changes as a diff and write nothing
  --only <names>   Migrate only these libraries, a comma-separated list
  --force          Write even when the git tree has uncommitted changes
  -h, --help       Show this help`;

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      yes: { type: "boolean", short: "y" },
      "dry-run": { type: "boolean" },
      only: { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
} catch (error) {
  console.error(`tinyswap: ${(error as Error).message}\n\n${USAGE}`);
  process.exit(2);
}
const { values, positionals } = args;
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (positionals.length > 1) {
  console.error(`tinyswap: takes one directory, got ${positionals.length}\n\n${USAGE}`);
  process.exit(2);
}

const root = resolve(positionals[0] ?? ".");
const dryRun = values["dry-run"] ?? false;
const yes = values.yes ?? false;
const only = values.only
  ?.split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const fail = (message: string): never => {
  p.cancel(message);
  process.exit(1);
};

p.intro(pc.inverse(" tinyswap "));

if (!existsSync(resolve(root, "package.json"))) fail(`${root} has no package.json.`);
for (const name of only ?? [])
  if (!byName.has(name))
    fail(`--only: tinyswap doesn't migrate ${name}. It knows ${[...byName.keys()].join(", ")}.`);
if (!yes && !dryRun && !process.stdin.isTTY)
  fail(
    "No terminal to ask in. Pass --yes to migrate everything found, or --dry-run to see the changes.",
  );

// Checked before any question, so nobody answers them only to be refused.
const changes = gitChanges(root);
if (!dryRun && !values.force) {
  if (!changes)
    fail(
      "This isn't a git repository, so the changes couldn't be undone. Pass --force to write anyway.",
    );
  else if (changes.length)
    fail(
      `The git tree has ${changes.length} uncommitted ${changes.length === 1 ? "change" : "changes"}. Commit or stash them first, so the migration's changes stand on their own, or pass --force.`,
    );
}

const spin = p.spinner();
spin.start("Looking for libraries to replace");
const project = scan(root);
spin.stop(
  `Read ${count(project.manifests.length, "package.json file")} and ${count(project.files.length, "source file")}`,
);

const usable = project.found.filter((found) => found.target);
const unusable = project.found.filter((found) => !found.target);
if (project.found.length) p.note(project.found.map(describe).join("\n"), "Found");
for (const found of unusable) p.log.warn(`${found.manifest}: ${found.reason}`);

const available = [...new Set(usable.map((found) => found.library.name))];
if (!available.length) {
  p.outro("Nothing to migrate.");
  process.exit(0);
}
for (const name of only ?? [])
  if (!available.includes(name))
    fail(`--only: ${name} isn't a dependency tinyswap can replace here.`);

let names = only ?? available;
if (!yes && !dryRun && !only) {
  const picked = await p.multiselect({
    message: "Which libraries should move?",
    options: available.map((name) => ({
      value: name,
      label: name,
      hint: [
        ...new Set(
          usable.filter((found) => found.library.name === name).map((found) => found.target),
        ),
      ].join(", "),
    })),
    initialValues: available,
    required: true,
  });
  if (p.isCancel(picked)) fail("Cancelled. Nothing was written.");
  names = picked as string[];
}

spin.start("Finding imports");
const result = plan(project, names, ranges());
spin.stop(
  `Found ${count(
    result.edits.reduce((sum, edit) => sum + edit.changes.length, 0),
    "import",
  )} to change in ${count(result.edits.length, "file")}`,
);

summarize(result);
if (!result.edits.length && !result.manifests.length) {
  p.outro("Nothing to change.");
  process.exit(0);
}

if (dryRun) {
  for (const edit of [...result.edits, ...result.manifests])
    printDiff(edit.file, edit.before, edit.after);
  p.outro("Dry run: nothing was written.");
  process.exit(0);
}

if (!yes) {
  const ok = await p.confirm({ message: "Apply these changes?" });
  if (p.isCancel(ok) || !ok) fail("Cancelled. Nothing was written.");
}

apply(root, result);
p.log.success(
  `Changed ${count(result.edits.length, "source file")} and ${count(result.manifests.length, "package.json file")}.`,
);

const manager = packageManager(root);
const install = `${manager.name} install`;
let installed = false;
if (result.manifests.length && !yes) {
  const run = await p.confirm({ message: `Run ${pc.cyan(install)} now?` });
  if (!p.isCancel(run) && run) {
    p.log.step(`Running ${install} in ${manager.dir}`);
    const { status } = spawnSync(manager.name, ["install"], {
      cwd: manager.dir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (status === 0) installed = true;
    else p.log.error(`${install} exited with ${status}. Run it again once that's fixed.`);
  }
}

const next = [
  ...(result.manifests.length && !installed
    ? [`Run ${pc.cyan(install)} to install the new dependencies.`]
    : []),
  "Run your tests, then commit.",
  ...(result.skipped.length
    ? [`Look at the ${count(result.skipped.length, "import")} left as it was, above.`]
    : []),
];
p.note(next.join("\n"), "Next");
p.outro(`Moved ${names.join(", ")}.`);

function describe(found: Found) {
  const version = found.version ?? found.range;
  const where = { node_modules: "installed", lockfile: "lockfile", "package.json": "range" }[
    found.from
  ];
  const target = found.target ? pc.green(found.target) : pc.yellow("no drop-in");
  return `${pc.bold(found.library.name)} ${version} → ${target} ${pc.dim(`(${found.manifest}, ${where})`)}`;
}

function summarize({ edits, manifests, skipped }: Plan) {
  const lines: string[] = [];
  for (const { file, changes } of edits) {
    lines.push(pc.bold(file));
    for (const { line, from, to } of changes)
      lines.push(`  ${pc.dim(`${line}:`)} ${from} → ${pc.green(to)}`);
  }
  for (const { file, removed, added, kept } of manifests) {
    lines.push(pc.bold(file));
    for (const name of removed) lines.push(`  ${pc.red(`- ${name}`)}`);
    for (const { name, range, field } of added)
      lines.push(`  ${pc.green(`+ ${name} ${range}`)} ${pc.dim(`(${field})`)}`);
    for (const name of kept)
      lines.push(`  ${pc.yellow(`= ${name}`)} ${pc.dim("(kept: an import of it couldn't move)")}`);
  }
  if (lines.length) p.note(lines.join("\n"), "Changes");
  for (const { file, line, specifier, reason } of skipped)
    p.log.warn(
      `${file}${line ? `:${line}` : ""}${specifier ? ` ${pc.bold(specifier)}` : ""}: ${reason}. Left as it was.`,
    );
}

function printDiff(file: string, before: string, after: string) {
  const patch = createTwoFilesPatch(`a/${file}`, `b/${file}`, before, after, undefined, undefined, {
    context: 3,
  });
  const body = patch.split("\n").slice(1).join("\n");
  process.stdout.write(
    `${body
      .split("\n")
      .map((line) =>
        line.startsWith("+++") || line.startsWith("---")
          ? pc.bold(line)
          : line.startsWith("+")
            ? pc.green(line)
            : line.startsWith("-")
              ? pc.red(line)
              : line.startsWith("@@")
                ? pc.cyan(line)
                : line,
      )
      .join("\n")}`,
  );
}

// The tiny packages release together with tinyswap, at one version, so
// its own version is theirs. An unreleased checkout asks for the latest.
function ranges(): Record<Tiny, string> {
  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    version: string;
  };
  const range = version === "0.0.0" ? "latest" : `^${version}`;
  return { tinyaml: range, tinyjson5: range, tinyini: range, tinylinkify: range };
}

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
