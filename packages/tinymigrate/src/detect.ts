// What a project uses: its package.json files, which originals they depend
// on and at which version, its source files, its package manager and whether
// its git tree is clean.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { byName, parseVersion, pickRange, type Library } from "./libraries.ts";
import { COMPONENT, SCRIPT } from "./rewrite.ts";

// peerDependencies stay: the package's users install the original.
export const FIELDS = ["dependencies", "optionalDependencies", "devDependencies"] as const;
export type Field = (typeof FIELDS)[number];

export interface Found {
  library: Library;
  /** The package.json that depends on it, relative to the project. */
  manifest: string;
  field: Field | "peerDependencies";
  range: string;
  /** The installed version, if one was found. */
  version?: string;
  from: "node_modules" | "lockfile" | "package.json";
  /** The subpath that replaces this version, or why there is none. */
  target?: string;
  reason?: string;
}

export interface Project {
  root: string;
  /** package.json files, relative to the root. */
  manifests: string[];
  /** Files with imports to read, relative to the root. */
  files: string[];
  found: Found[];
}

export function scan(root: string): Project {
  const listed = listFiles(root);
  const manifests = listed.filter(
    (file) => file === "package.json" || file.endsWith("/package.json"),
  );
  const files = listed.filter((file) => SCRIPT.test(file) || COMPONENT.test(file));
  const lockfile = findLockfile(root);
  const found: Found[] = [];
  for (const manifest of manifests) {
    const json = readJson(join(root, manifest));
    if (!json) continue;
    // A peer dependency alone stays, but still owns the imports below it.
    for (const field of [...FIELDS, "peerDependencies" as const]) {
      const deps = json[field];
      if (!deps || typeof deps !== "object") continue;
      for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
        if (
          field === "peerDependencies" &&
          FIELDS.some((other) => Object.hasOwn(json[other] ?? {}, name))
        )
          continue;
        const library = byName.get(name);
        if (!library || typeof range !== "string") continue;
        const dir = join(root, dirname(manifest));
        const linked = fromNodeModules(dir, name);
        const installed =
          linked ?? (lockfile ? fromLockfile(lockfile, dir, name, range) : undefined);
        const parsed = installed === undefined ? undefined : parseVersion(installed);
        // null when the range allows versions with different drop-ins.
        const picked = parsed ? library.pick(parsed) : pickRange(library, range);
        // A package's users install its peer dependencies, so code that
        // imports one keeps importing it.
        const peer = Object.hasOwn((json.peerDependencies as object | undefined) ?? {}, name);
        const target = peer ? undefined : (picked ?? undefined);
        found.push({
          library,
          manifest,
          field,
          range,
          version: installed,
          from: linked ? "node_modules" : installed ? "lockfile" : "package.json",
          target,
          reason: target
            ? undefined
            : peer
              ? `${name} is also a peer dependency, which this package's users install`
              : picked === undefined
                ? `${name} ${installed ?? range} has no drop-in: ${library.tiny} covers ${library.covers}`
                : `can't tell which ${name} "${range}" is: install the dependencies first`,
        });
      }
    }
  }
  return { root, manifests, files, found };
}

// Every file git doesn't ignore, or outside git every file but those in dot
// directories, leaving out node_modules and dist either way.
function listFiles(root: string): string[] {
  const skip = (path: string) => /(?:^|\/)(?:node_modules|dist)\//.test(path);
  const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  if (git.status === 0)
    return git.stdout
      .split("\0")
      .filter((file) => file && !skip(file) && existsSync(join(root, file)))
      .sort();
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !skip(`${path}/`)) visit(path);
      } else if (entry.isFile()) files.push(path);
    }
  };
  visit("");
  return files.sort();
}

export function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const json: unknown = JSON.parse(readFileSync(path, "utf8"));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

// The version Node would load from `dir`.
function fromNodeModules(dir: string, name: string): string | undefined {
  for (let at = dir; ; at = dirname(at)) {
    const json = readJson(join(at, "node_modules", name, "package.json"));
    if (typeof json?.version === "string") return json.version;
    if (dirname(at) === at) return undefined;
  }
}

// In the order a package manager reads them: npm prefers its shrinkwrap.
const LOCKFILES = {
  "pnpm-lock.yaml": "pnpm",
  "npm-shrinkwrap.json": "npm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
} as const;
export type PackageManager = (typeof LOCKFILES)[keyof typeof LOCKFILES];

/** The nearest lockfile at or above the root, up to the repository's root. */
export function findLockfile(root: string): string | undefined {
  for (let at = root; ; at = dirname(at)) {
    for (const name of Object.keys(LOCKFILES))
      if (existsSync(join(at, name))) return join(at, name);
    if (dirname(at) === at || existsSync(join(at, ".git"))) return undefined;
  }
}

/** The package manager that installs the project, and where to run it. */
export function packageManager(root: string): { name: PackageManager; dir: string } {
  const lockfile = findLockfile(root);
  if (lockfile)
    return {
      name: LOCKFILES[lockfile.slice(dirname(lockfile).length + 1) as keyof typeof LOCKFILES],
      dir: dirname(lockfile),
    };
  const declared = readJson(join(root, "package.json"))?.packageManager;
  const name = typeof declared === "string" ? declared.split("@")[0] : undefined;
  return {
    name: name === "pnpm" || name === "yarn" || name === "bun" ? name : "npm",
    dir: root,
  };
}

function fromLockfile(lockfile: string, dir: string, name: string, range: string) {
  const file = lockfile.slice(dirname(lockfile).length + 1);
  if (file === "bun.lockb" || !statSync(lockfile).isFile()) return undefined;
  const text = readFileSync(lockfile, "utf8");
  const importer = relative(dirname(lockfile), dir).split(sep).join("/");
  if (file === "pnpm-lock.yaml") return fromPnpm(text, importer || ".", name);
  if (file === "yarn.lock") return fromYarn(text, name, range);
  if (file === "bun.lock") return fromBun(text, name);
  return fromNpm(text, importer, name);
}

// pnpm 7 and later list each project under `importers:`, and pnpm 6 the
// root's dependencies at the top, as `name: version` or a `version:` line
// below the name.
export function fromPnpm(text: string, importer: string, name: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const unquote = (key: string) => key.trim().replace(/^(['"])(.*)\1$/, "$2");
  const indentOf = (line: string) => line.length - line.trimStart().length;
  let base = 0;
  let start = 0;
  const importers = lines.indexOf("importers:");
  if (importers !== -1) {
    const at = lines.findIndex(
      (line, i) =>
        i > importers &&
        indentOf(line) === 2 &&
        line.endsWith(":") &&
        unquote(line.slice(0, -1)) === importer,
    );
    if (at === -1) return undefined;
    base = 4;
    start = at + 1;
  } else if (importer !== ".") return undefined;
  let field = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const indent = indentOf(line);
    if (indent < base) break;
    if (indent === base)
      field = /^\s*(?:dependencies|devDependencies|optionalDependencies):/.test(line);
    if (!field || indent !== base + 2) continue;
    // Package names have no colon.
    const colon = line.indexOf(":");
    if (unquote(line.slice(0, colon)) !== name) continue;
    const inline = line.slice(colon + 1).trim();
    if (inline) return cleanVersion(inline);
    const next =
      lines[i + 1]?.match(/^\s+version:\s*(.+)$/) ?? lines[i + 2]?.match(/^\s+version:\s*(.+)$/);
    return next?.[1] ? cleanVersion(next[1]) : undefined;
  }
  return undefined;
}

// "4.1.0(supports-color@8.1.1)" and "'4.1.0'" read as 4.1.0, and a link or
// file version as none.
const cleanVersion = (text: string) => /^['"]?(\d+\.\d+\.\d+[^('"\s]*)/.exec(text)?.[1];

function fromNpm(text: string, importer: string, name: string): string | undefined {
  const json = JSON.parse(text) as {
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string }>;
  };
  const nested = importer ? `${importer}/node_modules/${name}` : undefined;
  return (
    (nested && json.packages?.[nested]?.version) ||
    json.packages?.[`node_modules/${name}`]?.version ||
    json.dependencies?.[name]?.version
  );
}

// yarn 1 and yarn 2 and later both start an entry with its descriptors,
// `js-yaml@^4.1.0, js-yaml@^4.0.0:` or `"js-yaml@npm:^4.1.0":`, and give its
// version on a line below.
export function fromYarn(text: string, name: string, range: string): string | undefined {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s|^#/.test(line) || !line.endsWith(":")) continue;
    // yarn 2 quotes the whole key, `"a@npm:^1.0.0, a@npm:^1.1.0":`, and
    // yarn 1 each descriptor that needs it.
    const descriptors = line
      .slice(0, -1)
      .split(",")
      .map((descriptor) => descriptor.trim().replace(/^"|"$/g, ""));
    const ranges = descriptors
      .filter((descriptor) => descriptor.startsWith(`${name}@`))
      .map((descriptor) => descriptor.slice(name.length + 1).replace(/^npm:/, ""));
    if (!ranges.includes(range.replace(/^npm:/, ""))) continue;
    for (let j = i + 1; j < lines.length && /^\s/.test(lines[j]!); j++) {
      const match = /^\s+version:?\s+"?([^"\s]+)"?/.exec(lines[j]!);
      if (match) return match[1];
    }
  }
  return undefined;
}

// bun.lock is JSON with trailing commas, whose `packages` map each name to
// `["name@version", ...]`.
function fromBun(text: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`^\\s*"${escaped}": \\["${escaped}@([^"]+)"`, "m").exec(text)?.[1];
}

/** The paths git reports as changed or untracked under the root. */
export function gitChanges(root: string): string[] | undefined {
  const git = spawnSync("git", ["status", "--porcelain", "--", "."], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.status !== 0) return undefined;
  return git.stdout.split("\n").filter(Boolean);
}
