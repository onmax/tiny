// Each entry against its reference, on fuzzed inputs and fixtures: the
// drop-in against linkify-it 5.0.2 (scripts/fuzz.ts), the GFM entries against
// remark-gfm (scripts/fuzz-gfm.ts), and markdown-exit with tinylinkify/gfm
// against GitHub's and remark-gfm's links on the GFM fixtures
// (scripts/gfm-fixtures.ts), whose scores the README lists.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vite-plus/test";

const run = (script: string, ...args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });

describe("tinylinkify/linkify-it against linkify-it 5.0.2", () => {
  it("matches on fuzzed inputs, apart from the engine's newer punctuation", () => {
    expect(run("scripts/fuzz.ts", "4000", "1")).toMatch(
      /^4000 inputs, \d+ calls: 0 differ, \d+ differ/m,
    );
  });
});

describe("tinylinkify and tinylinkify/gfm against remark-gfm", () => {
  it("find the same links in fuzzed plain text", () => {
    expect(run("scripts/fuzz-gfm.ts", "4000", "1")).toMatch(
      /^\d+ inputs, \d+ links: 0 differ from remark-gfm$/m,
    );
  });

  it("score as listed on the GFM fixtures", () => {
    const scores = JSON.parse(run("scripts/gfm-fixtures.ts", "--json"));
    expect(scores).toEqual([
      {
        suite: "GFM spec 0.29, autolinks",
        cases: 11,
        github: 10,
        remark: 11,
        remarkGithub: 10,
        linkifyItGithub: 6,
      },
      {
        suite: "micromark-extension-gfm-autolink-literal 2.1.0",
        cases: 22,
        github: 3,
        remark: 14,
        remarkGithub: 4,
        linkifyItGithub: 0,
      },
      {
        suite: "mdast-util-gfm-autolink-literal 2.1.0",
        cases: 30,
        github: 15,
        remark: 15,
        remarkGithub: 29,
        linkifyItGithub: 1,
      },
    ]);
  });
});
