import { describe, expect, it } from "vite-plus/test";
import { scan } from "../src/detect.ts";
import { apply, plan } from "../src/migrate.ts";
import { installed, project, read } from "./fixture.ts";

const RANGES = { tinyaml: "^1.2.0", tinyjson5: "^1.2.0", tinyini: "^1.2.0" };

const migrate = (root: string, names: string[]) => {
  const result = plan(scan(root), names, RANGES);
  apply(root, result);
  return result;
};

describe("plan", () => {
  it("points each import at the drop-in for the installed version", () => {
    const root = project({
      "package.json": { dependencies: { "js-yaml": "^4.1.0", json5: "^1.0.0", ini: "^1.3.0" } },
      ...installed("js-yaml", "4.1.0"),
      ...installed("json5", "1.0.2"),
      ...installed("ini", "1.3.8"),
      "src/a.ts": `import yaml from "js-yaml";\nimport JSON5 from 'json5';\nimport { join } from "node:path";\n`,
      "src/b.cjs": `const ini = require("ini");\nmodule.exports = () => import("json5");\n`,
      "src/c.js": `export const name = "js-yaml";\n`,
    });
    const result = migrate(root, ["js-yaml", "json5", "ini"]);
    expect(read(root, "src/a.ts")).toBe(
      `import yaml from "tinyaml/js-yaml";\nimport JSON5 from 'tinyjson5/json5-v1';\nimport { join } from "node:path";\n`,
    );
    expect(read(root, "src/b.cjs")).toBe(
      `const ini = require("tinyini/ini-v1");\nmodule.exports = () => import("tinyjson5/json5-v1");\n`,
    );
    expect(read(root, "src/c.js")).toBe(`export const name = "js-yaml";\n`);
    expect(result.edits.map(({ file, changes }) => ({ file, changes }))).toEqual([
      {
        file: "src/a.ts",
        changes: [
          { line: 1, from: "js-yaml", to: "tinyaml/js-yaml" },
          { line: 2, from: "json5", to: "tinyjson5/json5-v1" },
        ],
      },
      {
        file: "src/b.cjs",
        changes: [
          { line: 1, from: "ini", to: "tinyini/ini-v1" },
          { line: 2, from: "json5", to: "tinyjson5/json5-v1" },
        ],
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("migrates only the libraries picked", () => {
    const root = project({
      "package.json": { dependencies: { yaml: "^2.0.0", jju: "^1.4.0" } },
      "a.mjs": `import YAML from "yaml";\nimport { parse } from "jju";\n`,
    });
    migrate(root, ["jju"]);
    expect(read(root, "a.mjs")).toBe(
      `import YAML from "yaml";\nimport { parse } from "tinyjson5/jju";\n`,
    );
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      dependencies: { tinyjson5: "^1.2.0", yaml: "^2.0.0" },
    });
  });

  it("reports an import of a subpath with no drop-in, leaves it, and keeps the original", () => {
    const root = project({
      "package.json": { dependencies: { yaml: "^2.8.0", "@std/yaml": "^1.0.0" } },
      "a.ts": `import { parse } from "yaml";\nimport { Pair } from "yaml/types";\nimport { stringify } from "@std/yaml/stringify";\n`,
    });
    const result = migrate(root, ["yaml", "@std/yaml"]);
    expect(read(root, "a.ts")).toBe(
      `import { parse } from "tinyaml/yaml";\nimport { Pair } from "yaml/types";\nimport { stringify } from "tinyaml/std";\n`,
    );
    expect(result.skipped).toEqual([
      {
        file: "a.ts",
        line: 2,
        specifier: "yaml/types",
        reason: "tinyaml/yaml has no equivalent of yaml/types",
      },
    ]);
    expect(result.manifests).toEqual([
      expect.objectContaining({ removed: ["@std/yaml"], kept: ["yaml"] }),
    ]);
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      dependencies: { tinyaml: "^1.2.0", yaml: "^2.8.0" },
    });
  });

  it("reports an import of a name the drop-in doesn't export", () => {
    const root = project({
      "package.json": { dependencies: { yaml: "^2.8.0", jju: "^1.4.0" } },
      "a.ts": `import { parse, parseDocument } from "yaml";\nimport jju from "jju";\nconst { stringify } = require("yaml");\n`,
    });
    const result = migrate(root, ["yaml", "jju"]);
    expect(read(root, "a.ts")).toBe(
      `import { parse, parseDocument } from "yaml";\nimport jju from "jju";\nconst { stringify } = require("tinyaml/yaml");\n`,
    );
    expect(result.skipped).toEqual([
      expect.objectContaining({ line: 1, reason: "tinyaml/yaml doesn't export parseDocument" }),
      expect.objectContaining({ line: 2, reason: "tinyjson5/jju doesn't export default" }),
    ]);
    expect(result.manifests).toEqual([
      expect.objectContaining({
        removed: [],
        added: [{ name: "tinyaml", range: "^1.2.0", field: "dependencies" }],
        kept: ["yaml", "jju"],
      }),
    ]);
  });

  it("reports a require() of a drop-in whose only export is its default", () => {
    const root = project({
      "package.json": { dependencies: { "strip-json-comments": "^3.1.1" } },
      "a.cjs": `const strip = require("strip-json-comments");\nconst { default: strip2 } = require("strip-json-comments");\n`,
      "b.mjs": `import strip from "strip-json-comments";\n`,
    });
    const result = migrate(root, ["strip-json-comments"]);
    expect(read(root, "a.cjs")).toBe(
      `const strip = require("strip-json-comments");\nconst { default: strip2 } = require("tinyjson5/strip-json-comments");\n`,
    );
    expect(read(root, "b.mjs")).toBe(`import strip from "tinyjson5/strip-json-comments";\n`);
    expect(result.skipped).toEqual([
      {
        file: "a.cjs",
        line: 1,
        specifier: "strip-json-comments",
        reason:
          "require() of tinyjson5/strip-json-comments gives { default }, so the function is under .default",
      },
    ]);
  });

  it("keeps a mock where an import it stands in for stays", () => {
    const root = project({
      "package.json": { devDependencies: { yaml: "^2.8.0", "js-yaml": "^4.1.0" } },
      "a.test.ts": `import { parse } from "yaml";\nimport { parseDocument } from "yaml";\nimport { load } from "js-yaml";\nvi.mock("yaml");\nvi.mock("js-yaml");\n`,
      "b.test.ts": `import { parse } from "yaml";\nimport { parseDocument } from "yaml";\n`,
    });
    const result = migrate(root, ["yaml", "js-yaml"]);
    expect(read(root, "a.test.ts")).toBe(
      `import { parse } from "yaml";\nimport { parseDocument } from "yaml";\nimport { load } from "tinyaml/js-yaml";\nvi.mock("yaml");\nvi.mock("tinyaml/js-yaml");\n`,
    );
    // Without a mock, each import moves on its own.
    expect(read(root, "b.test.ts")).toBe(
      `import { parse } from "tinyaml/yaml";\nimport { parseDocument } from "yaml";\n`,
    );
    const mocked = "a mock of yaml in this file stands in for an import of it that stays";
    expect(result.skipped.map(({ file, line, reason }) => ({ file, line, reason }))).toEqual([
      { file: "a.test.ts", line: 1, reason: mocked },
      { file: "a.test.ts", line: 2, reason: "tinyaml/yaml doesn't export parseDocument" },
      { file: "a.test.ts", line: 4, reason: mocked },
      { file: "b.test.ts", line: 2, reason: "tinyaml/yaml doesn't export parseDocument" },
    ]);
  });

  it("leaves imports a nearer package.json has only as a peer dependency", () => {
    const root = project({
      "package.json": { private: true, devDependencies: { "js-yaml": "^4.1.0" } },
      "packages/lib/package.json": { peerDependencies: { "js-yaml": "^4.0.0" } },
      "packages/lib/index.js": `import { load } from "js-yaml";\n`,
    });
    const result = migrate(root, ["js-yaml"]);
    expect(read(root, "packages/lib/index.js")).toBe(`import { load } from "js-yaml";\n`);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        file: "packages/lib/index.js",
        reason:
          "js-yaml is also a peer dependency, which this package's users install, in packages/lib/package.json",
      }),
    ]);
  });

  it("keeps an original a package.json script runs", () => {
    const root = project({
      "package.json": {
        scripts: { build: "json5 -c config.json5 && vite build", test: "vitest" },
        devDependencies: { json5: "^2.2.3" },
      },
      "a.mjs": `import JSON5 from "json5";\n`,
    });
    const result = migrate(root, ["json5"]);
    expect(read(root, "a.mjs")).toBe(`import JSON5 from "tinyjson5/json5";\n`);
    expect(result.skipped).toEqual([
      {
        file: "package.json",
        reason: `the "build" script runs json5, and tinyjson5 has no command-line tool for it`,
      },
    ]);
    expect(JSON.parse(read(root, "package.json")).devDependencies).toEqual({
      json5: "^2.2.3",
      tinyjson5: "^1.2.0",
    });
  });

  it("keeps an original a component's markup names", () => {
    const root = project({
      "package.json": { dependencies: { "js-yaml": "^4.1.0" } },
      "a.svelte": `<script>\n  import { load } from "js-yaml";\n</script>\n{#await import("js-yaml") then yaml}{/await}\n`,
      "b.vue": `<script setup>\nimport { load } from "js-yaml";\n</script>\n<template><p>js-yaml</p></template>\n`,
    });
    const result = migrate(root, ["js-yaml"]);
    expect(read(root, "a.svelte")).toContain(`import { load } from "tinyaml/js-yaml";`);
    expect(read(root, "b.vue")).toContain(`import { load } from "tinyaml/js-yaml";`);
    expect(result.skipped).toEqual([
      {
        file: "a.svelte",
        reason: "it names js-yaml outside its <script> blocks, which tinymigrate doesn't rewrite",
      },
    ]);
    expect(JSON.parse(read(root, "package.json")).dependencies).toEqual({
      "js-yaml": "^4.1.0",
      tinyaml: "^1.2.0",
    });
  });

  it("reports a file it can't parse, and leaves it", () => {
    const root = project({
      "package.json": { dependencies: { ini: "^7.0.0" } },
      "a.js": `import ini from "ini";\nconst = ;\n`,
    });
    const result = migrate(root, ["ini"]);
    expect(read(root, "a.js")).toBe(`import ini from "ini";\nconst = ;\n`);
    expect(result.skipped).toEqual([
      { file: "a.js", reason: expect.stringMatching(/^can't parse it: .* at line 2$/) },
    ]);
    expect(JSON.parse(read(root, "package.json"))).toEqual({ dependencies: { ini: "^7.0.0" } });
  });

  it("leaves imports a nearer package.json owns at a version with no drop-in", () => {
    const root = project({
      "package.json": { private: true, dependencies: { "js-yaml": "^4.1.0" } },
      "packages/legacy/package.json": { dependencies: { "js-yaml": "^3.14.0" } },
      "packages/legacy/index.js": `import { safeLoad } from "js-yaml";\n`,
      "index.js": `import { load } from "js-yaml";\n`,
    });
    const result = migrate(root, ["js-yaml"]);
    expect(read(root, "packages/legacy/index.js")).toBe(`import { safeLoad } from "js-yaml";\n`);
    expect(read(root, "index.js")).toBe(`import { load } from "tinyaml/js-yaml";\n`);
    expect(result.skipped).toEqual([
      {
        file: "packages/legacy/index.js",
        line: 1,
        specifier: "js-yaml",
        reason:
          "js-yaml ^3.14.0 has no drop-in: tinyaml covers 4 and 5, in packages/legacy/package.json",
      },
    ]);
    expect(JSON.parse(read(root, "packages/legacy/package.json"))).toEqual({
      dependencies: { "js-yaml": "^3.14.0" },
    });
  });

  it("uses the nearest package.json's version in a workspace", () => {
    const root = project({
      "package.json": { private: true, devDependencies: { "js-yaml": "^4.1.0" } },
      "packages/old/package.json": { dependencies: { "js-yaml": "^5.0.0" } },
      "packages/new/package.json": { dependencies: { react: "^19.0.0" } },
      "packages/old/index.js": `import { load } from "js-yaml";\n`,
      "packages/new/index.js": `import yaml from "js-yaml";\n`,
      "scripts/build.js": `import yaml from "js-yaml";\n`,
    });
    migrate(root, ["js-yaml"]);
    expect(read(root, "packages/old/index.js")).toBe(
      `import { load } from "tinyaml/js-yaml-v5";\n`,
    );
    expect(read(root, "packages/new/index.js")).toBe(`import yaml from "tinyaml/js-yaml";\n`);
    expect(read(root, "scripts/build.js")).toBe(`import yaml from "tinyaml/js-yaml";\n`);
    expect(JSON.parse(read(root, "packages/old/package.json"))).toEqual({
      dependencies: { tinyaml: "^1.2.0" },
    });
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      private: true,
      devDependencies: { tinyaml: "^1.2.0" },
    });
  });

  it("skips an import no package.json above it decides, when they disagree", () => {
    const root = project({
      "package.json": { private: true },
      "a/package.json": { dependencies: { "js-yaml": "^4.1.0" } },
      "b/package.json": { dependencies: { "js-yaml": "^5.0.0" } },
      "c/index.js": `require("js-yaml");\n`,
    });
    const result = migrate(root, ["js-yaml"]);
    expect(read(root, "c/index.js")).toBe(`require("js-yaml");\n`);
    expect(result.skipped).toEqual([
      expect.objectContaining({ file: "c/index.js", line: 1, specifier: "js-yaml" }),
    ]);
  });
});

describe("package.json", () => {
  it("swaps each original for its tiny package in the same field, and drops its types", () => {
    const root = project({
      "package.json": `{
    "name": "app",
    "dependencies": {
        "ini": "^4.1.3",
        "zod": "^4.0.0"
    },
    "devDependencies": {
        "@types/ini": "^4.1.1",
        "@types/js-yaml": "^4.0.9",
        "js-yaml": "^4.1.0",
        "jsonc-parser": "^3.3.1",
        "vitest": "^4.0.0"
    }
}
`,
    });
    const result = migrate(root, ["ini", "js-yaml", "jsonc-parser"]);
    expect(read(root, "package.json")).toBe(`{
    "name": "app",
    "dependencies": {
        "tinyini": "^1.2.0",
        "zod": "^4.0.0"
    },
    "devDependencies": {
        "tinyaml": "^1.2.0",
        "tinyjson5": "^1.2.0",
        "vitest": "^4.0.0"
    }
}
`);
    expect(result.manifests).toEqual([
      expect.objectContaining({
        file: "package.json",
        removed: ["ini", "@types/ini", "js-yaml", "@types/js-yaml", "jsonc-parser"],
        added: [
          { name: "tinyini", range: "^1.2.0", field: "dependencies" },
          { name: "tinyaml", range: "^1.2.0", field: "devDependencies" },
          { name: "tinyjson5", range: "^1.2.0", field: "devDependencies" },
        ],
        kept: [],
      }),
    ]);
  });

  it("adds a tiny package once, to the strongest field, and keeps one already there", () => {
    const root = project({
      "package.json": {
        dependencies: { yaml: "^2.0.0", tinyjson5: "^1.0.0" },
        devDependencies: { "js-yaml": "^4.0.0", json5: "^2.0.0" },
      },
    });
    migrate(root, ["yaml", "js-yaml", "json5"]);
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      dependencies: { tinyaml: "^1.2.0", tinyjson5: "^1.0.0" },
    });
  });

  it("moves a tiny package up to the field it's now needed in", () => {
    const root = project({
      "package.json": { dependencies: { ini: "^7.0.0" }, devDependencies: { tinyini: "^1.0.0" } },
    });
    migrate(root, ["ini"]);
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      dependencies: { tinyini: "^1.0.0" },
    });
  });

  it("appends to unsorted dependencies, and keeps tabs and CRLF", () => {
    const root = project({
      "package.json": `{\r\n\t"dependencies": {\r\n\t\t"zod": "^4.0.0",\r\n\t\t"comment-json": "^4.2.0",\r\n\t\t"abc": "1.0.0"\r\n\t}\r\n}`,
    });
    migrate(root, ["comment-json"]);
    expect(read(root, "package.json")).toBe(
      `{\r\n\t"dependencies": {\r\n\t\t"zod": "^4.0.0",\r\n\t\t"abc": "1.0.0",\r\n\t\t"tinyjson5": "^1.2.0"\r\n\t}\r\n}`,
    );
  });
});
