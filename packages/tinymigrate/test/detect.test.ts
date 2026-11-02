import { describe, expect, it } from "vite-plus/test";
import { fromPnpm, fromYarn, gitChanges, packageManager, scan } from "../src/detect.ts";
import { installed, project, write } from "./fixture.ts";

const found = (root: string) =>
  scan(root).found.map(({ library, manifest, field, version, from, target, reason }) => ({
    name: library.name,
    manifest,
    field,
    version,
    from,
    target,
    reason,
  }));

describe("detection", () => {
  it("finds each original in every package.json and dependency field", () => {
    const root = project({
      "package.json": {
        dependencies: { "js-yaml": "^4.1.0", react: "^19.0.0" },
        devDependencies: { json5: "^2.2.3" },
        peerDependencies: { ini: "^4.0.0" },
      },
      "packages/a/package.json": { optionalDependencies: { ini: "1.3.8" } },
    });
    expect(found(root)).toEqual([
      expect.objectContaining({ name: "js-yaml", manifest: "package.json", field: "dependencies" }),
      expect.objectContaining({
        name: "json5",
        manifest: "package.json",
        field: "devDependencies",
      }),
      expect.objectContaining({
        name: "ini",
        manifest: "packages/a/package.json",
        field: "optionalDependencies",
      }),
    ]);
  });

  it("takes the installed version first, then the lockfile's, then the range's", () => {
    const root = project({
      "package.json": {
        dependencies: { "js-yaml": "*", json5: "^1.0.0 || ^2.0.0", ini: "^2.0.0" },
      },
      ...installed("js-yaml", "5.0.0"),
      "package-lock.json": {
        lockfileVersion: 3,
        packages: {
          "node_modules/json5": { version: "1.0.2" },
          "node_modules/js-yaml": { version: "4.1.0" },
        },
      },
    });
    expect(found(root)).toEqual([
      expect.objectContaining({
        name: "js-yaml",
        version: "5.0.0",
        from: "node_modules",
        target: "tinyaml/js-yaml-v5",
      }),
      expect.objectContaining({
        name: "json5",
        version: "1.0.2",
        from: "lockfile",
        target: "tinyjson5/json5-v1",
      }),
      expect.objectContaining({
        name: "ini",
        version: undefined,
        from: "package.json",
        target: "tinyini/ini-v2",
      }),
    ]);
  });

  it("explains a version with no drop-in, and a range it can't read", () => {
    const root = project({
      "package.json": { dependencies: { "js-yaml": "^3.14.0", yaml: "latest" } },
    });
    expect(found(root)).toEqual([
      expect.objectContaining({
        name: "js-yaml",
        target: undefined,
        reason: "js-yaml ^3.14.0 has no drop-in: tinyaml covers 4 and 5",
      }),
      expect.objectContaining({
        name: "yaml",
        target: undefined,
        reason: `can't tell which yaml "latest" is: install the dependencies first`,
      }),
    ]);
  });

  it("reads a workspace package's version from the lockfile's importer for it", () => {
    const root = project({
      "package.json": { private: true },
      "packages/app/package.json": { dependencies: { "@std/yaml": "npm:@jsr/std__yaml@^1.0.0" } },
      "pnpm-lock.yaml": `lockfileVersion: '9.0'

importers:

  .: {}

  packages/app:
    dependencies:
      '@std/yaml':
        specifier: npm:@jsr/std__yaml@^1.0.0
        version: '@jsr/std__yaml@1.0.5'
`,
    });
    expect(found(root)).toEqual([
      expect.objectContaining({ name: "@std/yaml", target: "tinyaml/std" }),
    ]);
  });

  it("reads bun.lock", () => {
    const root = project({
      "package.json": { dependencies: { "strip-json-comments": "*" } },
      "bun.lock": `{\n  "lockfileVersion": 1,\n  "packages": {\n    "strip-json-comments": ["strip-json-comments@5.0.3", "", {}, "sha512-x"],\n  },\n}\n`,
    });
    expect(found(root)).toEqual([
      expect.objectContaining({
        version: "5.0.3",
        from: "lockfile",
        target: "tinyjson5/strip-json-comments-v5",
      }),
    ]);
  });

  it("lists source files, leaving out node_modules, dist and what git ignores, but not dot directories", () => {
    const root = project(
      {
        ".gitignore": "node_modules\ngenerated/\n",
        "package.json": {},
        "src/a.ts": "",
        "src/b.vue": "",
        "src/c.md": "",
        "dist/d.js": "",
        "generated/e.js": "",
        "packages/x/node_modules/f/index.js": "",
        ".storybook/main.ts": "",
      },
      { git: true },
    );
    write(root, { "src/untracked.mjs": "" });
    expect(scan(root).files).toEqual([
      ".storybook/main.ts",
      "src/a.ts",
      "src/b.vue",
      "src/untracked.mjs",
    ]);
  });

  it("lists source files outside git too", () => {
    const root = project({
      "package.json": {},
      "a.cjs": "",
      "dist/b.js": "",
      "node_modules/c/d.js": "",
    });
    expect(scan(root).files).toEqual(["a.cjs"]);
  });
});

describe("lockfiles", () => {
  it("reads pnpm 6's top-level dependencies, inline or below the name", () => {
    expect(
      fromPnpm("lockfileVersion: 5.4\n\ndependencies:\n  js-yaml: 4.1.0\n", ".", "js-yaml"),
    ).toBe("4.1.0");
    expect(
      fromPnpm(
        "lockfileVersion: '6.0'\n\ndevDependencies:\n  json5:\n    specifier: ^2.2.0\n    version: 2.2.3\n",
        ".",
        "json5",
      ),
    ).toBe("2.2.3");
    expect(
      fromPnpm(
        "importers:\n  .:\n    dependencies:\n      yaml:\n        specifier: ^2\n        version: 2.8.1(supports-color@8.1.1)\n",
        ".",
        "yaml",
      ),
    ).toBe("2.8.1");
  });

  it("reads yarn 1 and yarn 2 entries, matching the range", () => {
    const v1 = `# yarn lockfile v1\n\njs-yaml@^3.13.1:\n  version "3.14.1"\n\njs-yaml@^4.0.0, js-yaml@^4.1.0:\n  version "4.1.0"\n`;
    expect(fromYarn(v1, "js-yaml", "^4.1.0")).toBe("4.1.0");
    expect(fromYarn(v1, "js-yaml", "^3.13.1")).toBe("3.14.1");
    const berry = `__metadata:\n  version: 8\n\n"ini@npm:^1.3.8":\n  version: 1.3.8\n  resolution: "ini@npm:1.3.8"\n`;
    expect(fromYarn(berry, "ini", "^1.3.8")).toBe("1.3.8");
    const combined = `"ini@npm:^1.3.0, ini@npm:^1.3.8":\n  version: 1.3.8\n\n"ini@npm:^4.1.0":\n  version: 4.1.3\n`;
    expect(fromYarn(combined, "ini", "^1.3.0")).toBe("1.3.8");
    expect(fromYarn(combined, "ini", "^1.3.8")).toBe("1.3.8");
  });

  it("reads npm-shrinkwrap.json over package-lock.json, as npm does", () => {
    const lock = (version: string) => ({
      lockfileVersion: 3,
      packages: { "node_modules/js-yaml": { version } },
    });
    const root = project({
      "package.json": { dependencies: { "js-yaml": "*" } },
      "package-lock.json": lock("4.1.0"),
      "npm-shrinkwrap.json": lock("5.0.0"),
    });
    expect(found(root)).toEqual([expect.objectContaining({ version: "5.0.0", from: "lockfile" })]);
  });
});

describe("environment", () => {
  it("picks the package manager from the lockfile, then packageManager", () => {
    expect(packageManager(project({ "package.json": {}, "yarn.lock": "" })).name).toBe("yarn");
    expect(packageManager(project({ "package.json": {}, "bun.lock": "{}" })).name).toBe("bun");
    expect(packageManager(project({ "package.json": {}, "pnpm-lock.yaml": "" })).name).toBe("pnpm");
    expect(packageManager(project({ "package.json": {}, "package-lock.json": "{}" })).name).toBe(
      "npm",
    );
    expect(
      packageManager(project({ "package.json": { packageManager: "pnpm@10.0.0" } })).name,
    ).toBe("pnpm");
    expect(packageManager(project({ "package.json": {} }, { git: true })).name).toBe("npm");
  });

  it("finds a workspace's lockfile above it", () => {
    const root = project({
      "package.json": {},
      "pnpm-lock.yaml": "",
      "packages/a/package.json": {},
    });
    expect(packageManager(`${root}/packages/a`)).toEqual({ name: "pnpm", dir: root });
  });

  it("reports git changes, or none outside git", () => {
    const root = project({ "package.json": {} }, { git: true });
    expect(gitChanges(root)).toEqual([]);
    write(root, { "a.js": "" });
    expect(gitChanges(root)).toEqual(["?? a.js"]);
    expect(gitChanges(project({ "package.json": {} }))).toBeUndefined();
  });
});
