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

  it("invalidates both rules when the files to lint change", async () => {
    const fixture = createProjectFixture({
      framework: "vite",
      files: { ".vite-doctor/cache/.keep": "" },
    });
    const run = (options: Parameters<typeof tinyaml>[0]) =>
      fixture.run({
        files: { "a.yaml": "x: false\n", "b.yaml": "x: no\n", "c.yaml": "x: [\n" },
        extensions: [tinyaml(options)],
        config: { extends: ["tinyaml/recommended"] },
        run: { cache: true },
      });
    const codes = async (options: Parameters<typeof tinyaml>[0]) =>
      (await run(options)).diagnostics.map(({ code }) => code);
    try {
      expect(await codes({ include: "a.yaml" })).toEqual([]);
      expect(await codes({ include: "b.yaml" })).toEqual(["TINYAML0002"]);
      expect(await codes({ include: "*.yaml", exclude: ["b.yaml", "c.yaml"] })).toEqual([]);
      expect(await codes({ include: "*.yaml", exclude: ["a.yaml", "b.yaml"] })).toEqual([
        "TINYAML0001",
      ]);
      expect(await codes({ include: "a.yaml" })).toEqual([]);
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

  it("point at the value past byte order marks", async () => {
    const fixture = createProjectFixture({ framework: "vite" });
    try {
      const text = "﻿a: no\n...\r\n﻿x: no\n";
      const { diagnostics } = await fixture.run({
        files: { "a.yaml": text },
        extensions: [tinyaml()],
        config: { extends: ["tinyaml/recommended"] },
      });
      expect(diagnostics.map(({ range }) => range && text.slice(range.start))).toEqual([
        "no\n...\r\n﻿x: no\n",
        "no\n",
      ]);
      expect(diagnostics.map(({ sources }) => sources?.[0]?.replace(/.*\//, ""))).toEqual([
        "a.yaml:1:4",
        "a.yaml:3:5",
      ]);
    } finally {
      await fixture.dispose();
    }
  });

  it("point at each problem past the byte order marks that start documents, whatever the line breaks", async () => {
    const fixture = createProjectFixture({ framework: "vite" });
    const files: Record<string, string> = {};
    for (const [name, lines] of Object.entries({ lf: "\n", crlf: "\r\n", cr: "\r" })) {
      files[`ambiguous-${name}.yaml`] = "\uFEFFa: no\n...\n\uFEFFx: no\n".replaceAll("\n", lines);
      files[`invalid-${name}.yaml`] = "a\n...\n\uFEFFx: [no, }\n".replaceAll("\n", lines);
    }
    try {
      const { diagnostics } = await fixture.run({
        files,
        extensions: [tinyaml()],
        config: { extends: ["tinyaml/recommended"] },
      });
      expect(
        diagnostics
          .map(({ code, sources, range }) => {
            const [, file, line, column] = /([^/]*):(\d+):(\d+)$/.exec(sources![0]!)!;
            const at = files[file!]!.slice(range!.start, range!.start + 2).trim();
            return `${code} ${file}:${line}:${column} ${range!.line}:${range!.column} ${at}`;
          })
          .sort(),
      ).toEqual(
        ["lf", "crlf", "cr"]
          .flatMap((name) => [
            `TINYAML0001 invalid-${name}.yaml:3:10 3:10 }`,
            `TINYAML0002 ambiguous-${name}.yaml:1:4 1:4 no`,
            `TINYAML0002 ambiguous-${name}.yaml:3:5 3:5 no`,
          ])
          .sort(),
      );
    } finally {
      await fixture.dispose();
    }
  });
});
