import { describe, expect, it } from "vite-plus/test";
import { findSpecifiers, replaceSpecifiers } from "../src/rewrite.ts";

// Points every js-yaml import at tinyaml/js-yaml.
function migrate(code: string, file = "file.ts") {
  const found = findSpecifiers(code, file);
  if ("error" in found) throw new Error(found.error);
  return replaceSpecifiers(code, found.specifiers, ({ value }) =>
    value === "js-yaml" ? "tinyaml/js-yaml" : undefined,
  );
}

describe("rewriting", () => {
  it.each([
    ["import", `import yaml from "js-yaml";`, `import yaml from "tinyaml/js-yaml";`],
    [
      "named import",
      `import { load, dump } from 'js-yaml'`,
      `import { load, dump } from 'tinyaml/js-yaml'`,
    ],
    [
      "namespace import",
      `import * as yaml from "js-yaml";`,
      `import * as yaml from "tinyaml/js-yaml";`,
    ],
    [
      "type import",
      `import type { LoadOptions } from "js-yaml";`,
      `import type { LoadOptions } from "tinyaml/js-yaml";`,
    ],
    ["side-effect import", `import "js-yaml";`, `import "tinyaml/js-yaml";`],
    ["export from", `export { load } from "js-yaml";`, `export { load } from "tinyaml/js-yaml";`],
    ["export star", `export * from "js-yaml";`, `export * from "tinyaml/js-yaml";`],
    [
      "export star as",
      `export * as yaml from "js-yaml";`,
      `export * as yaml from "tinyaml/js-yaml";`,
    ],
    [
      "dynamic import",
      `const yaml = await import("js-yaml");`,
      `const yaml = await import("tinyaml/js-yaml");`,
    ],
    [
      "dynamic import of a template",
      "await import(`js-yaml`);",
      "await import(`tinyaml/js-yaml`);",
    ],
    ["require", `const yaml = require('js-yaml');`, `const yaml = require('tinyaml/js-yaml');`],
    ["require.resolve", `require.resolve("js-yaml")`, `require.resolve("tinyaml/js-yaml")`],
    [
      "import = require",
      `import yaml = require("js-yaml");`,
      `import yaml = require("tinyaml/js-yaml");`,
    ],
    [
      "import type",
      `type Yaml = typeof import("js-yaml");`,
      `type Yaml = typeof import("tinyaml/js-yaml");`,
    ],
    ["vi.mock", `vi.mock("js-yaml", () => ({}));`, `vi.mock("tinyaml/js-yaml", () => ({}));`],
    [
      "jest.requireActual",
      `jest.requireActual("js-yaml")`,
      `jest.requireActual("tinyaml/js-yaml")`,
    ],
  ])("%s", (_, before, after) => {
    expect(migrate(before)).toBe(after);
  });

  it("keeps the formatting around each specifier", () => {
    const code = `import {\n  load,\n  dump, // the writer\n} from    "js-yaml"  ;\nconst y = require(\n  'js-yaml'\n)\n`;
    expect(migrate(code)).toBe(code.replaceAll("js-yaml", "tinyaml/js-yaml"));
  });

  it("leaves strings that aren't imports", () => {
    const code = [
      `// import yaml from "js-yaml";`,
      `/* require("js-yaml") */`,
      `const name = "js-yaml";`,
      'const text = `import x from "js-yaml"`;',
      `obj.require("js-yaml");`,
      `foo("js-yaml");`,
      `constructor.mock("js-yaml");`,
      `vi.toString("js-yaml");`,
      `const dynamic = require("js-" + "yaml");`,
      "const template = import(`${'js-yaml'}`);",
      `const yaml = require("js-yaml");`,
    ].join("\n");
    expect(migrate(code).split("\n")).toEqual([
      ...code.split("\n").slice(0, -1),
      `const yaml = require("tinyaml/js-yaml");`,
    ]);
  });

  it("reads JSX in .js and .tsx files", () => {
    expect(
      migrate(`import y from "js-yaml";\nconst a = <p>Don't {require("js-yaml")}</p>;`, "a.js"),
    ).toBe(
      `import y from "tinyaml/js-yaml";\nconst a = <p>Don't {require("tinyaml/js-yaml")}</p>;`,
    );
    expect(migrate(`import y from "js-yaml";\nconst f = <T,>(x: T) => <b>{x}</b>;`, "a.tsx")).toBe(
      `import y from "tinyaml/js-yaml";\nconst f = <T,>(x: T) => <b>{x}</b>;`,
    );
  });

  it("reads declaration files", () => {
    expect(
      migrate(`import type { Schema } from "js-yaml";\nexport declare const a: Schema;`, "a.d.ts"),
    ).toBe(`import type { Schema } from "tinyaml/js-yaml";\nexport declare const a: Schema;`);
  });

  it("reads CommonJS files", () => {
    expect(migrate(`const y = require("js-yaml");\nreturn;`, "a.cjs")).toBe(
      `const y = require("tinyaml/js-yaml");\nreturn;`,
    );
  });

  it("gives line numbers and the parser's error", () => {
    expect(findSpecifiers(`\n\nimport y from "js-yaml";`, "a.mjs")).toEqual({
      specifiers: [
        { value: "js-yaml", start: 17, end: 24, line: 3, kind: "import", names: ["default"] },
      ],
    });
    expect(findSpecifiers(`import y from "js-yaml";\nconst = 1;`, "a.ts")).toEqual({
      error: expect.stringContaining("line 2"),
    });
  });
});

describe("names", () => {
  const read = (code: string, file = "a.ts") => {
    const found = findSpecifiers(code, file);
    if ("error" in found) throw new Error(found.error);
    return found.specifiers.map(({ kind, names }) => ({ kind, names }));
  };

  it("gives the value exports each import reads", () => {
    expect(read(`import a, { b, c as d, "e-f" as g, type T } from "m";`)).toEqual([
      { kind: "import", names: ["default", "b", "c", "e-f"] },
    ]);
    expect(read(`import type { T } from "m";\nimport * as ns from "m";\nimport "m";`)).toEqual([
      { kind: "import", names: [] },
      { kind: "import", names: [] },
      { kind: "import", names: [] },
    ]);
    expect(read(`export { a, default as b, type T } from "m";\nexport * from "m";`)).toEqual([
      { kind: "import", names: ["a", "default"] },
      { kind: "other", names: [] },
    ]);
  });

  it("gives the names a require() reads", () => {
    expect(
      read(
        `const { a, b: c, ...rest } = require("m");\nconst d = require("m").e;\nconst f = require("m");\nimport g = require("m");\nrequire.resolve("m");`,
      ),
    ).toEqual([
      { kind: "require", names: ["a", "b"] },
      { kind: "require", names: ["e"] },
      { kind: "require", names: [] },
      { kind: "require", names: [] },
      { kind: "other", names: [] },
    ]);
  });
});

describe("components", () => {
  it("rewrites the <script> blocks of a .vue file", () => {
    const code = `<script setup lang="ts">\nimport yaml from "js-yaml";\nconst x: number = 1;\n</script>\n\n<template>\n  <p>import "js-yaml"</p>\n</template>\n<script>\nexport default { a: require('js-yaml') };\n</script>\n`;
    expect(migrate(code, "a.vue")).toBe(
      code
        .replace(`from "js-yaml"`, `from "tinyaml/js-yaml"`)
        .replace(`'js-yaml'`, `'tinyaml/js-yaml'`),
    );
  });

  it("rewrites a .svelte file's script", () => {
    const code = `<script>\n  import { load } from "js-yaml";\n</script>\n<p>{load("a: 1").a}</p>\n`;
    expect(migrate(code, "a.svelte")).toBe(code.replace(`"js-yaml"`, `"tinyaml/js-yaml"`));
  });

  it("rewrites an .astro file's frontmatter and scripts", () => {
    const code = `---\nimport { load } from "js-yaml";\nconst data: unknown = load("a: 1");\n---\n<p>import "js-yaml"</p>\n<script>\n  import("js-yaml");\n</script>\n`;
    expect(migrate(code, "a.astro")).toBe(
      code
        .replace(`from "js-yaml"`, `from "tinyaml/js-yaml"`)
        .replace(`import("js-yaml")`, `import("tinyaml/js-yaml")`),
    );
  });

  it("gives lines in the whole file", () => {
    const found = findSpecifiers(
      `<template/>\n<script>\nimport y from "js-yaml";\n</script>`,
      "a.vue",
    );
    expect(found).toEqual({ specifiers: [expect.objectContaining({ value: "js-yaml", line: 3 })] });
  });
});
