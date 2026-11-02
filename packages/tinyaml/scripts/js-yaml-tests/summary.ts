// Summarizes run.sh's output and checks it against what's expected.
// `direct` reads the TAP log of js-yaml 4's suite run against tinyaml;
// `diff` reads the calls the wrapper recorded. `-v` lists what differs.
import { readFileSync } from "node:fs";
import { Baseline, shorten } from "../baseline.ts";
import { expectCount, expectList, fail } from "../support.ts";

// tinyaml has no `listener` option, which these two tests use.
const FAILING = [
  "Listener informed on a very simple scalar.",
  "Listener informed on a map with a list.",
];

const [mode, file, flag] = process.argv.slice(2);
const verbose = flag === "-v";
const text = readFileSync(file!, "utf8");

if (mode === "direct") {
  const lines = text.split("\n");
  const failed: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const test = /^\s*not ok \d+ - (.*)$/.exec(lines[i]!);
    if (!test) continue;
    // A suite fails when a test in it fails; only tests count.
    let type = "";
    for (let j = i + 1; j < lines.length && !type && !/^\s*\.\.\.$/.test(lines[j]!); j++)
      type = /^\s*type: '(\w+)'/.exec(lines[j]!)?.[1] ?? "";
    if (type === "test") failed.push(test[1]!);
  }
  const total = (name: string) => Number(new RegExp(`^# ${name} (\\d+)$`, "m").exec(text)?.[1]);
  console.log(
    `js-yaml 4 tests on tinyaml: ${total("pass")} pass, ${total("fail")} fail, ${total("skipped")} skipped, of ${total("tests")}`,
  );
  if (verbose) for (const name of failed) console.log(`  ${name}`);
  if (!(total("tests") > 0)) fail(`no test totals in ${file}`);
  expectList("failing tests", failed, FAILING);
} else {
  const entries: {
    fn: string;
    status: string;
    /** A hash of the function, the whole input and the options, callbacks' source included. */
    call: string;
    input: string;
    options?: string;
    expected: string;
    actual?: string;
  }[] = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const count: Record<string, number> = {};
  for (const { fn, status } of entries)
    count[`${fn} ${status}`] = (count[`${fn} ${status}`] ?? 0) + 1;
  const by = (status: string) => entries.filter((entry) => entry.status === status);
  console.log(
    `js-yaml 4 calls replayed through tinyaml: ${entries.length}, ${by("pass").length} the same, ${by("pass-message").length} the same reason with another message or mark, ${by("pass-error").length} another error message`,
  );
  for (const [key, n] of Object.entries(count).sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${key}: ${n}`);
  if (verbose)
    for (const entry of entries)
      if (entry.status !== "pass")
        console.log(
          `\n--- ${entry.fn} ${entry.status}\n${entry.input}\n  js-yaml: ${entry.expected}\n  tinyaml: ${entry.actual}`,
        );
  expectCount("calls recorded", entries.length, 1, Infinity);
  // A call is the function, the whole input and the options, with the
  // source of each callback in them (see wrapper.cjs). Made more than once,
  // it must give the same outcome each time, so that its one record holds
  // for all.
  const outcome = (entry: (typeof entries)[number]) =>
    `${entry.status}\n  js-yaml: ${entry.expected}\n  tinyaml: ${entry.actual}`;
  const calls = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    const first = calls.get(entry.call);
    if (!first) calls.set(entry.call, entry);
    else if (outcome(entry) !== outcome(first))
      fail(
        `${entry.fn} ${JSON.stringify(entry.input)} ${entry.options}, made more than once, gives two outcomes:\n${outcome(first)}\n${outcome(entry)}`,
      );
  }
  // Each call that doesn't match exactly is a record in
  // scripts/baselines/js-yaml-tests.json with its function, options,
  // identity and both outcomes, so any change to one fails, as does a call
  // that differs anew. Calls run in no fixed order, so each is at 0, sorted
  // by identity.
  const baseline = new Baseline("js-yaml-tests", "replay", entries.length);
  for (const entry of [...calls.values()].sort((a, b) => (a.call < b.call ? -1 : 1)))
    if (entry.status !== "pass")
      baseline.add(
        0,
        entry.status,
        entry.input,
        { fn: entry.fn, options: shorten(entry.options ?? ""), call: entry.call },
        { "js-yaml": shorten(entry.expected), tinyaml: shorten(entry.actual ?? "") },
      );
  baseline.finish();
}
