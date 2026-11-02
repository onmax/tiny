// Runs tinyaml-lint as a user would, in a project of its own. Under
// test/dist.config.ts, the loader in NODE_OPTIONS runs dist/cli.mjs, the
// package's bin, in place of src/cli.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";

const cli = resolve("src/cli.ts");
mkdirSync("node_modules/.cache", { recursive: true });
const project = resolve(mkdtempSync("node_modules/.cache/cli-"));
afterAll(() => rmSync(project, { recursive: true, force: true }));

const files: Record<string, string> = {
  "clean.yaml": "draft: false\n",
  "config.yaml": "draft: no\n",
  "site.yaml": "title: Hello\ntitle: World\n",
  "flow.yaml": "[? a\n::]\n",
  "directive.yaml": "a:,%\nx\n",
  "scalar.yaml": "key: a:,no\n",
  "node_modules/dep.yaml": "draft: no\n",
  "dist/out.yaml": "draft: no\n",
  "nested/deep.yml": "port: 0b10\n",
};
for (const [file, text] of Object.entries(files)) {
  mkdirSync(dirname(resolve(project, file)), { recursive: true });
  writeFileSync(resolve(project, file), text);
}

const run = (...args: string[]) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], {
    cwd: project,
    encoding: "utf8",
  });
  return { status, stdout, stderr };
};

const NO =
  '`no` loads as the string "no", but PyYAML and yaml\'s YAML 1.1 schema read it as a boolean.';
const BOOLEAN = "Quote it to keep the string, or write `true` or `false`.";

describe("tinyaml-lint", () => {
  it("prints one line per problem and exits with 1", () => {
    expect(run("clean.yaml", "config.yaml", "site.yaml")).toEqual({
      status: 1,
      stdout: `config.yaml:1:8 tinyaml/ambiguous-value ${NO} ${BOOLEAN}
site.yaml:2:1 tinyaml/invalid-yaml tinyaml can't load this YAML: duplicated mapping key. Fix the YAML at this position.
`,
      stderr: "",
    });
  });

  it("exits with 0 on clean YAML", () => {
    expect(run("clean.yaml", "flow.yaml", "directive.yaml", "scalar.yaml")).toEqual({
      status: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("prints the problems as a JSON array with --format json", () => {
    const { status, stdout } = run("--format", "json", "config.yaml", "flow.yaml");
    expect(status).toBe(1);
    expect(JSON.parse(stdout)).toEqual([
      {
        file: "config.yaml",
        rule: "tinyaml/ambiguous-value",
        severity: "warn",
        line: 1,
        column: 8,
        offset: 7,
        message: NO,
        fix: BOOLEAN,
      },
    ]);
    expect(run("--format", "json", "flow.yaml", "directive.yaml", "scalar.yaml")).toEqual({
      status: 0,
      stdout: "[]\n",
      stderr: "",
    });
  });

  it("expands globs, skipping node_modules and dist", () => {
    const { status, stdout } = run("**/*.{yaml,yml}");
    expect(status).toBe(1);
    expect(stdout.split("\n").map((line) => line.split(" ")[0])).toEqual([
      "config.yaml:1:8",
      "nested/deep.yml:1:7",
      "site.yaml:2:1",
      "",
    ]);
  });

  it("exits with 1 on a file it can't read or a glob that matches nothing", () => {
    expect(run("clean.yaml", "missing.yaml")).toEqual({
      status: 1,
      stdout: "",
      stderr: "tinyaml-lint: can't read missing.yaml\n",
    });
    expect(run("*.json")).toEqual({
      status: 1,
      stdout: "",
      stderr: "tinyaml-lint: *.json matches no files\n",
    });
  });

  it.runIf(process.env.NODE_OPTIONS?.includes("dist-loader"))("runs as the bin npm links", () => {
    const { bin } = JSON.parse(readFileSync("package.json", "utf8"));
    const { status, stdout } = spawnSync(resolve(bin["tinyaml-lint"]), ["config.yaml"], {
      cwd: project,
      encoding: "utf8",
    });
    expect({ status, stdout }).toEqual({
      status: 1,
      stdout: `config.yaml:1:8 tinyaml/ambiguous-value ${NO} ${BOOLEAN}\n`,
    });
  });

  it("prints its usage, and exits with 2 on bad arguments", () => {
    const help = run("--help");
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/^Usage: tinyaml-lint /);
    expect(run().status).toBe(2);
    expect(run("--format", "xml", "clean.yaml").status).toBe(2);
  });
});
