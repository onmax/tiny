// Runs linkify-it 5.0.2's own tests, copied unchanged into
// test/suites/linkify-it-5.0.2, against linkify-it itself, to check the copy,
// and against tinylinkify/linkify-it, through scripts/redirect.ts. Prints the
// counts and each failing test, and exits non-zero when tinylinkify fails one
// or a file runs no tests.
// Usage: node scripts/linkify-it-tests.ts
import { spawnSync } from "node:child_process";
import { readdirSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DIR = "test/suites/linkify-it-5.0.2";
// Real paths, so linkify-it finds its own dependencies through pnpm's links.
const href = (path: string) => pathToFileURL(realpathSync(path)).href;
// Each target: a label, the module the tests import, and the one `require` gets.
const TARGETS: [string, string, string][] = [
  ["linkify-it 5.0.2", "node_modules/linkify-it/index.mjs", "node_modules/linkify-it/build/index.cjs.js"],
  ["tinylinkify/linkify-it", "src/linkify-it/index.ts", "src/linkify-it/index.ts"],
];
const files = readdirSync(DIR).filter((file) => file.endsWith(".test.mjs")).sort();

let failed = 0;
for (const [label, target, required] of TARGETS) {
  for (const file of files) {
    const run = spawnSync(
      process.execPath,
      ["--import", "./scripts/redirect.ts", "--test", "--test-reporter=tap", `${DIR}/${file}`],
      {
        encoding: "utf8",
        env: { ...process.env, REDIRECT_TARGET: href(target), REDIRECT_REQUIRE: href(required) },
      },
    );
    const count = (key: string) => Number(run.stdout.match(new RegExp(`^# ${key} (\\d+)$`, "m"))?.[1]);
    // A failing suite reports failureType 'subtestsFailed'; only its tests count.
    const fails = [
      ...run.stdout.matchAll(
        /^ *not ok \d+ - ([^\n]*)\n(?:(?! *not ok| *ok )[^\n]*\n)*? *failureType: '(\w+)'/gm,
      ),
    ]
      .filter((m) => m[2] !== "subtestsFailed")
      .map((m) => m[1]);
    const [pass, fail] = [count("pass"), count("fail")];
    if (!pass && !fail) failed++;
    else failed += fail;
    console.log(`${label.padEnd(24)} ${file.padEnd(22)} ${pass}/${pass + fail} pass`);
    for (const test of fails) console.log(`  FAIL ${test}`);
    if (!pass && !fail) console.log(run.stderr.slice(0, 2000));
  }
}
console.log(`${failed} failing tests`);
process.exitCode = failed ? 1 : 0;
