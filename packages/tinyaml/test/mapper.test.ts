// TypeScript 7.1 checks the projects in test/mapper with the built content
// mapper, which their tsconfig names by the package's path, and which
// TypeScript runs as package.json says.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { build } from "../scripts/dist.ts";

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** What tsrs prints for a project in test/mapper. */
async function check(project: string): Promise<string> {
  const args = ["-p", root(`test/mapper/${project}`), "--runExternalCode", "--pretty", "false"];
  try {
    await promisify(execFile)(root("node_modules/.bin/tsrs"), args, { cwd: root("test/mapper") });
    return "";
  } catch (error) {
    return (error as { stdout: string }).stdout.trim();
  }
}

beforeAll(build);

describe("content mapper", () => {
  it("types a YAML file as resolveJsonModule types JSON, and documents as a tuple", async () => {
    expect(await check("tsconfig.json")).toBe("");
  });

  it("types values as `as const` would with `literal`", async () => {
    expect(await check("tsconfig.literal.json")).toBe("");
  });

  it("reports what it can't type where it is", async () => {
    expect((await check("errors")).split("\n").sort()).toEqual([
      "errors/recursive.yaml(1,1): error tinyaml2: a recursive alias can't be typed",
      "errors/syntax.yaml(3,1): error tinyaml1: missing comma in flow collection",
    ]);
  });
});
