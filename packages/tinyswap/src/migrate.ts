// Turns what a scan found into the edits for the libraries picked: each
// import of them pointed at its drop-in, and each package.json's
// dependencies swapped. Nothing here writes until `apply`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FIELDS, readJson, type Field, type Found, type Project } from "./detect.ts";
import { EXPORTS, libraryOf, type Library, type Tiny } from "./libraries.ts";
import { findSpecifiers, replaceSpecifiers, type Specifier } from "./rewrite.ts";

export interface Change {
  line: number;
  from: string;
  to: string;
}

export interface FileEdit {
  /** Relative to the project. */
  file: string;
  before: string;
  after: string;
}

export interface Edit extends FileEdit {
  changes: Change[];
}

export interface Skipped {
  file: string;
  line?: number;
  specifier?: string;
  reason: string;
}

export interface ManifestEdit extends FileEdit {
  removed: string[];
  added: { name: string; range: string; field: Field }[];
  /** Originals that stay because an import of them couldn't move. */
  kept: string[];
}

export interface Plan {
  edits: Edit[];
  manifests: ManifestEdit[];
  skipped: Skipped[];
}

/**
 * The edits that move `names` to their drop-ins. `ranges` gives the version
 * range each tiny package is added with.
 */
export function plan(project: Project, names: string[], ranges: Record<Tiny, string>): Plan {
  // A declaration with no drop-in still decides which imports are its own.
  const declared = project.found.filter((found) => names.includes(found.library.name));
  const picked = declared.filter((found) => found.target);
  const edits: Edit[] = [];
  const skipped: Skipped[] = [];
  // Each dependency, as its package.json and name, with an import that
  // stays, and with one that moves.
  const blocked = new Set<string>();
  const moved = new Set<string>();

  for (const file of project.files) {
    const before = readFileSync(join(project.root, file), "utf8");
    // Escapes can spell a library without its name appearing in the source.
    const mentioned = picked.filter(
      ({ library }) => before.includes(library.name) || before.includes("\\"),
    );
    if (!mentioned.length) continue;
    // An original the file may import without tinyswap reading it stays,
    // everywhere if no one package.json owns its imports.
    const keep = ({ library, manifest }: Found) => {
      const owner = ownerOf(declared, library.name, file);
      blocked.add(`${owner?.manifest ?? manifest}\0${library.name}`);
    };
    const result = findSpecifiers(before, file);
    if ("error" in result) {
      skipped.push({ file, reason: `can't parse it: ${result.error}` });
      for (const found of mentioned) keep(found);
      continue;
    }
    // A component's markup can import too, as in Svelte's `{#await import("yaml")}`.
    for (const name of new Set(picked.map(({ library }) => library.name))) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      if (!result.markup || !new RegExp(`["'\`]${escaped}(?:/[^"'\`]*)?["'\`]`).test(result.markup))
        continue;
      skipped.push({
        file,
        reason: `it names ${name} outside its <script> blocks, which tinyswap doesn't rewrite`,
      });
      for (const found of picked) if (found.library.name === name) keep(found);
    }
    const decisions = new Map<Specifier, { target?: string; reason?: string }>();
    for (const specifier of result.specifiers) {
      const match = libraryOf(specifier.value);
      if (match && names.includes(match.library.name))
        decisions.set(
          specifier,
          decide(specifier, match, ownerOf(declared, match.library.name, file)),
        );
    }
    // A mock stands in for every import of its library in the file, so if
    // one of them stays, the mock and the others stay with it.
    const nameOf = (specifier: Specifier) => libraryOf(specifier.value)!.library.name;
    const entries = [...decisions];
    for (const [specifier, decision] of entries) {
      const name = nameOf(specifier);
      const same = entries.filter(([other]) => nameOf(other) === name);
      const mocked = same.some(([other]) => other.kind === "mock");
      if (decision.target && mocked && same.some(([, other]) => other.reason))
        decisions.set(specifier, {
          reason: `a mock of ${name} in this file stands in for an import of it that stays`,
        });
    }
    const changes: Change[] = [];
    const after = replaceSpecifiers(before, result.specifiers, (specifier) => {
      const decision = decisions.get(specifier);
      if (!decision) return undefined;
      const { value, line } = specifier;
      const library = libraryOf(value)!.library.name;
      const owner = ownerOf(declared, library, file);
      if (decision.reason) {
        skipped.push({ file, line, specifier: value, reason: decision.reason });
        if (owner) blocked.add(`${owner.manifest}\0${library}`);
        return undefined;
      }
      moved.add(`${owner!.manifest}\0${library}`);
      changes.push({ line, from: value, to: decision.target! });
      return decision.target;
    });
    if (changes.length) edits.push({ file, before, after, changes });
  }

  const manifests: ManifestEdit[] = [];
  for (const manifest of new Set(picked.map((found) => found.manifest))) {
    // The drop-ins have no command-line tools, so a script that runs an
    // original's keeps it.
    const scripts = readJson(join(project.root, manifest))?.scripts ?? {};
    for (const { library } of picked.filter((found) => found.manifest === manifest))
      for (const [script, command] of Object.entries(scripts as Record<string, unknown>))
        for (const bin of library.bins ?? [])
          if (typeof command === "string" && runs(command, bin)) {
            skipped.push({
              file: manifest,
              reason: `the "${script}" script runs ${bin}, and ${library.tiny} has no command-line tool for it`,
            });
            blocked.add(`${manifest}\0${library.name}`);
          }
    const edit = editManifest(
      project.root,
      manifest,
      picked.filter((found) => found.manifest === manifest),
      (name) => blocked.has(`${manifest}\0${name}`),
      (name) => moved.has(`${manifest}\0${name}`),
      ranges,
    );
    if (edit) manifests.push(edit);
  }
  return { edits, manifests, skipped };
}

// Where one specifier of a library picked goes, or why it stays.
function decide(
  { value, kind, names: read }: Specifier,
  { library, subpath }: { library: Library; subpath: string },
  owner: Found | undefined,
): { target?: string; reason?: string } {
  if (!owner)
    return {
      reason: `the package.json files that depend on ${library.name} pick different drop-ins, and none of them is above this file`,
    };
  const target = owner.target;
  if (!target) return { reason: `${owner.reason!}, in ${owner.manifest}` };
  if (subpath && !library.subpaths?.includes(subpath))
    return { reason: `${target} has no equivalent of ${value}` };
  const exports = EXPORTS[target]!;
  const missing = read.filter((name) => !exports.includes(name));
  if (missing.length) return { reason: `${target} doesn't export ${missing.join(", ")}` };
  // require() gives an ES module's exports, so a function that is the
  // default export is under `.default`.
  if (kind === "require" && !read.length && exports.length === 1)
    return {
      reason: `require() of ${target} gives { default }, so the function is under .default`,
    };
  return { target };
}

// Whether a shell command runs `bin`, as a command of its own.
const runs = (command: string, bin: string) =>
  new RegExp(`(?:^|[\\s;&|(])${bin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s;&|)])`).test(
    command,
  );

// The dependency an import resolves to: the one in the nearest package.json
// above the file, or the only drop-in every package.json picks.
function ownerOf(picked: Found[], name: string, file: string): Found | undefined {
  const candidates = picked.filter((found) => found.library.name === name);
  let best: Found | undefined;
  for (const found of candidates) {
    const dir = dirname(found.manifest);
    if (dir !== "." && !file.startsWith(`${dir}/`)) continue;
    if (!best || dir.length > dirname(best.manifest).length) best = found;
  }
  if (best) return best;
  return new Set(candidates.map((found) => found.target)).size === 1 ? candidates[0] : undefined;
}

// A dependency field outranks the ones after it: a drop-in that replaces a
// dependency and a devDependency is a dependency.
const RANK: Record<Field, number> = {
  dependencies: 0,
  optionalDependencies: 1,
  devDependencies: 2,
};

function editManifest(
  root: string,
  manifest: string,
  found: Found[],
  blocked: (name: string) => boolean,
  moved: (name: string) => boolean,
  ranges: Record<Tiny, string>,
): ManifestEdit | undefined {
  const before = readFileSync(join(root, manifest), "utf8");
  const json = JSON.parse(before) as Record<string, Record<string, string> | undefined>;
  const removed: string[] = [];
  const kept: string[] = [];
  const needs = new Map<Tiny, Field>();
  // Only a peer dependency alone has that field, and it has no drop-in.
  for (const { library, field } of found as (Found & { field: Field })[]) {
    // The tiny package comes in once an import uses it or the original goes.
    if (moved(library.name) || !blocked(library.name)) {
      const best = needs.get(library.tiny);
      if (best === undefined || RANK[field] < RANK[best]) needs.set(library.tiny, field);
    }
    if (blocked(library.name)) {
      kept.push(library.name);
      continue;
    }
    delete json[field]![library.name];
    removed.push(library.name);
    // Its types go with it, from wherever they are.
    for (const other of FIELDS)
      if (library.types && json[other]?.[library.types] !== undefined) {
        delete json[other]![library.types];
        removed.push(library.types);
      }
  }
  const added: ManifestEdit["added"] = [];
  for (const [tiny, field] of needs) {
    const current = FIELDS.find((other) => json[other]?.[tiny] !== undefined);
    if (current && RANK[current] <= RANK[field]) continue;
    const range = current ? json[current]![tiny]! : ranges[tiny];
    if (current) delete json[current]![tiny];
    json[field] = insert(json[field] ?? {}, tiny, range);
    added.push({ name: tiny, range, field });
  }
  if (!removed.length && !added.length) return undefined;
  // A field the migration emptied goes, and one that was empty stays.
  const original = JSON.parse(before) as typeof json;
  for (const field of FIELDS)
    if (
      json[field] &&
      !Object.keys(json[field]).length &&
      Object.keys(original[field] ?? {}).length
    )
      delete json[field];
  const indent = /^\{\r?\n([ \t]+)"/.exec(before)?.[1] ?? "  ";
  const newline = before.includes("\r\n") ? "\r\n" : "\n";
  let after = JSON.stringify(json, null, indent);
  if (newline !== "\n") after = after.replaceAll("\n", newline);
  if (/\r?\n$/.test(before)) after += newline;
  return { file: manifest, before, after, removed, added, kept };
}

// Adds a key where it sorts, if the keys are sorted, or at the end.
function insert(deps: Record<string, string>, name: string, range: string) {
  const keys = Object.keys(deps);
  const sorted = keys.every((key, i) => i === 0 || keys[i - 1]! <= key);
  if (!sorted) return { ...deps, [name]: range };
  return Object.fromEntries(
    [...Object.entries(deps), [name, range] as const].sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

export function apply(root: string, { edits, manifests }: Plan) {
  for (const { file, after } of [...edits, ...manifests]) writeFileSync(join(root, file), after);
}
