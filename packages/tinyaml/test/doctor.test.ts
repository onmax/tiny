import { describe, expect, it } from "vite-plus/test";
import { createProjectFixture } from "vite-doctor/testkit";
import tinyaml from "../src/doctor.ts";

describe("Doctor cache", () => {
  it("invalidates both rules when clean YAML contents change", async () => {
    const fixture = createProjectFixture({
      framework: "vite",
      // Keep Doctor's persistent cache between fixture runs.
      files: { ".vite-doctor/cache/.keep": "" },
    });
    const run = (text: string) =>
      fixture.run({
        files: { "config.yaml": text },
        extensions: [tinyaml()],
        config: { extends: ["tinyaml/recommended"] },
        run: { cache: true },
      });
    try {
      expect((await run("flag: false\n")).diagnostics).toEqual([]);
      expect((await run("flag: no\n")).diagnostics.map(({ code }) => code)).toEqual([
        "TINYAML0002",
      ]);
      expect((await run("flag: false\n")).diagnostics).toEqual([]);
      expect((await run("flag: [\n")).diagnostics.map(({ code }) => code)).toEqual(["TINYAML0001"]);
    } finally {
      await fixture.dispose();
    }
  });
});

describe("Doctor rules", () => {
  it("lint YAML whose plain scalars hold `:` and flow punctuation", async () => {
    const fixture = createProjectFixture({ framework: "vite" });
    try {
      const { diagnostics } = await fixture.run({
        files: {
          "a.yaml": "[? a\n::]\n",
          "b.yaml": "a:,%\nx\n",
          "c.yaml": "key: a:,no\nvalue: .1_0\n",
        },
        extensions: [tinyaml()],
        config: { extends: ["tinyaml/recommended"] },
      });
      expect(
        diagnostics.map(({ code, sources }) => `${code} ${sources?.[0]?.replace(/.*\//, "")}`),
      ).toEqual(["TINYAML0002 c.yaml:2:8"]);
    } finally {
      await fixture.dispose();
    }
  });
});
