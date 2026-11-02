// Runs tinyswap as a user would. Without a terminal it only runs with
// --yes or --dry-run, which is how these tests drive it.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { installed, project, read, write, type Files } from "./fixture.ts";

const cli = resolve("src/cli.ts");

const run = (cwd: string, ...args: string[]) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined },
  });
  return { status, output: stdout + stderr };
};

const app = (files: Files = {}) =>
  project(
    {
      ".gitignore": "node_modules\n",
      "package.json": { name: "app", dependencies: { "js-yaml": "^4.1.0", ini: "^7.0.0" } },
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      ...installed("js-yaml", "4.1.0"),
      ...installed("ini", "7.0.0"),
      "src/config.ts": `import yaml from "js-yaml";\nimport ini from "ini";\n`,
      "src/legacy.cjs": `const { load } = require('js-yaml');\nconst dist = require("js-yaml/dist/js-yaml.js");\n`,
      ...files,
    },
    { git: true },
  );

describe("tinyswap", () => {
  it("prints its usage", () => {
    const { status, output } = run(".", "--help");
    expect(status).toBe(0);
    expect(output).toMatch(/^Usage: tinyswap \[dir\] \[options\]/);
    expect(output).toContain("--dry-run");
  });

  it("rejects an unknown flag", () => {
    const { status, output } = run(".", "--frobnicate");
    expect(status).toBe(2);
    expect(output).toContain("Unknown option '--frobnicate'");
  });

  it("--dry-run prints a diff and writes nothing", () => {
    const root = app();
    const { status, output } = run(root, "--dry-run");
    expect(status).toBe(0);
    expect(output).toContain("js-yaml 4.1.0 → tinyaml/js-yaml (package.json, installed)");
    expect(output).toContain("ini 7.0.0 → tinyini/ini (package.json, installed)");
    expect(output).toContain(`--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,2 @@
-import yaml from "js-yaml";
-import ini from "ini";
+import yaml from "tinyaml/js-yaml";
+import ini from "tinyini/ini";`);
    expect(output).toContain(`-const { load } = require('js-yaml');
+const { load } = require('tinyaml/js-yaml');
 const dist = require("js-yaml/dist/js-yaml.js");`);
    expect(output).toContain(
      "src/legacy.cjs:2 js-yaml/dist/js-yaml.js: tinyaml/js-yaml has no equivalent of js-yaml/dist/js-yaml.js. Left as it was.",
    );
    expect(output).toContain(`     "js-yaml": "^4.1.0",
-    "ini": "^7.0.0"
+    "tinyaml": "latest",
+    "tinyini": "latest"`);
    expect(output).toContain("Dry run: nothing was written.");
    expect(read(root, "src/config.ts")).toBe(
      `import yaml from "js-yaml";\nimport ini from "ini";\n`,
    );
    expect(
      spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout,
    ).toBe("");
  });

  it("--yes migrates everything found and says to install", () => {
    const root = app();
    const { status, output } = run(root, "--yes");
    expect(status).toBe(0);
    expect(read(root, "src/config.ts")).toBe(
      `import yaml from "tinyaml/js-yaml";\nimport ini from "tinyini/ini";\n`,
    );
    expect(read(root, "src/legacy.cjs")).toBe(
      `const { load } = require('tinyaml/js-yaml');\nconst dist = require("js-yaml/dist/js-yaml.js");\n`,
    );
    expect(JSON.parse(read(root, "package.json"))).toEqual({
      name: "app",
      dependencies: { "js-yaml": "^4.1.0", tinyaml: "latest", tinyini: "latest" },
    });
    expect(output).toContain("Found 3 imports to change in 2 files");
    expect(output).toContain("= js-yaml (kept: an import of it couldn't move)");
    expect(output).toContain("Changed 2 source files and 1 package.json file.");
    expect(output).toContain("Run pnpm install to install the new dependencies.");
    expect(output).toContain("Moved js-yaml, ini.");
  });

  it("--only migrates the libraries named", () => {
    const root = app();
    expect(run(root, "--yes", "--only", "ini").status).toBe(0);
    expect(read(root, "src/config.ts")).toBe(
      `import yaml from "js-yaml";\nimport ini from "tinyini/ini";\n`,
    );
    expect(JSON.parse(read(root, "package.json")).dependencies).toEqual({
      "js-yaml": "^4.1.0",
      tinyini: "latest",
    });
  });

  it("--only rejects a library it doesn't know or the project doesn't use", () => {
    const root = app();
    expect(run(root, "--yes", "--only", "lodash")).toEqual({
      status: 1,
      output: expect.stringContaining("--only: tinyswap doesn't migrate lodash."),
    });
    expect(run(root, "--yes", "--only", "json5")).toEqual({
      status: 1,
      output: expect.stringContaining(
        "--only: json5 isn't a dependency tinyswap can replace here.",
      ),
    });
  });

  it("refuses to write to a dirty tree, unless --force", () => {
    const root = app();
    write(root, { "src/config.ts": `import yaml from "js-yaml";\n` });
    const refused = run(root, "--yes");
    expect(refused.status).toBe(1);
    expect(refused.output).toContain("The git tree has 1 uncommitted change.");
    expect(read(root, "src/config.ts")).toBe(`import yaml from "js-yaml";\n`);
    expect(run(root, "--yes", "--force").status).toBe(0);
    expect(read(root, "src/config.ts")).toBe(`import yaml from "tinyaml/js-yaml";\n`);
  });

  it("refuses to write outside git, unless --force", () => {
    const root = project({
      "package.json": { dependencies: { yamljs: "^0.3.0" } },
      "index.js": `const YAML = require("yamljs");\n`,
    });
    expect(run(root, "--yes")).toEqual({
      status: 1,
      output: expect.stringContaining("This isn't a git repository"),
    });
    expect(run(root, "--yes", "--force").status).toBe(0);
    expect(read(root, "index.js")).toBe(`const YAML = require("tinyaml/yamljs");\n`);
  });

  it("takes the directory as an argument", () => {
    const root = app();
    expect(run(resolve(root, ".."), resolve(root), "--yes").status).toBe(0);
    expect(read(root, "src/config.ts")).toBe(
      `import yaml from "tinyaml/js-yaml";\nimport ini from "tinyini/ini";\n`,
    );
  });

  it("says when there's nothing to migrate", () => {
    const root = project(
      {
        "package.json": { dependencies: { "js-yaml": "^3.14.0" } },
        "a.js": `require("js-yaml");\n`,
      },
      { git: true },
    );
    const { status, output } = run(root, "--yes");
    expect(status).toBe(0);
    expect(output).toContain("js-yaml ^3.14.0 has no drop-in: tinyaml covers 4 and 5");
    expect(output).toContain("Nothing to migrate.");
  });

  it("asks for --yes or --dry-run without a terminal", () => {
    const { status, output } = run(app());
    expect(status).toBe(1);
    expect(output).toContain("No terminal to ask in.");
  });
});
