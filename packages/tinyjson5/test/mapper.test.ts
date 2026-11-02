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
  it("types JSON5 and JSON with comments as resolveJsonModule types JSON", async () => {
    expect(await check("tsconfig.json")).toBe("");
  });

  it("types values as `as const` would with `literal`", async () => {
    expect(await check("tsconfig.literal.json")).toBe("");
  });

  it("reports a syntax error where it is", async () => {
    expect((await check("errors")).split("\n").sort()).toEqual([
      "errors/syntax-cr.json5(2,7): error tinyjson51: invalid character '2'",
      "errors/syntax-crlf.json5(2,7): error tinyjson51: invalid character '2'",
      "errors/syntax-eof.json5(3,1): error tinyjson51: invalid end of input",
      "errors/syntax-ls.json5(2,7): error tinyjson51: invalid character '2'",
      "errors/syntax-ps.json5(2,7): error tinyjson51: invalid character '2'",
      "errors/syntax.json5(3,9): error tinyjson51: invalid character '2'",
    ]);
  });
});
