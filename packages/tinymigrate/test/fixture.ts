// Fixture projects, each in a folder of its own under node_modules/.cache.
// Git stops looking for a repository at that folder, so a fixture without
// `git: true` is outside any.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterAll } from "vite-plus/test";

const cache = resolve("node_modules/.cache");
mkdirSync(cache, { recursive: true });
process.env.GIT_CEILING_DIRECTORIES = cache;

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

export type Files = Record<string, string | object>;

/** A project with these files, JSON for objects, committed to git if `git` is set. */
export function project(files: Files, { git = false } = {}): string {
  const root = mkdtempSync(join(cache, "tinymigrate-"));
  made.push(root);
  write(root, files);
  if (git) {
    const run = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    run("init", "-q");
    run("add", "-A");
    run(
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      "init",
    );
  }
  return root;
}

export function write(root: string, files: Files) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(
      join(root, file),
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    );
  }
}

export const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");

/** node_modules/<name>/package.json at `version`. */
export const installed = (name: string, version: string, at = "") => ({
  [`${at}node_modules/${name}/package.json`]: { name, version },
});
