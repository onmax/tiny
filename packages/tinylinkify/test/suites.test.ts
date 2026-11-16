// linkify-it 5.0.2's own tests, copied unchanged into test/suites, with
// tinylinkify/linkify-it in its place (scripts/linkify-it-tests.ts). The
// original must pass them too, or the copy is wrong.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vite-plus/test";

describe("linkify-it 5.0.2's test suite", () => {
  it("passes every test, as linkify-it does", () => {
    const out = execFileSync(process.execPath, ["scripts/linkify-it-tests.ts"], {
      encoding: "utf8",
    });
    for (const label of ["linkify-it 5.0.2", "tinylinkify/linkify-it"]) {
      expect(out).toMatch(new RegExp(`^${label} +test\\.test\\.mjs +172/172 pass$`, "m"));
      expect(out).toMatch(new RegExp(`^${label} +pathological\\.test\\.mjs +3/3 pass$`, "m"));
      expect(out).toMatch(new RegExp(`^${label} +build\\.test\\.mjs +1/1 pass$`, "m"));
    }
    expect(out).toMatch(/^0 failing tests$/m);
  });
});
