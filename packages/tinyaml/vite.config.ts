import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

// Each mode's entries, built together. src/core/mode.ts resolves to
// src/core/mode/<mode>.ts there, whose constants the bundler folds, so an
// entry carries none of the other modes' parser branches. An entry goes
// under the mode whose flags its engine sets: `yaml` over `spec`, one per
// `lenient` engine, or neither for js5.
export const MODES = {
  spec: { index: "src/index.ts" },
  yaml: { yaml: "src/yaml/index.ts" },
  "js-yaml": { "js-yaml": "src/js-yaml/index.ts" },
  std: { std: "src/std/index.ts" },
  yamljs: { yamljs: "src/yamljs/index.ts" },
  js5: { "js-yaml-v5": "src/js-yaml-v5/index.ts" },
};
// The linter, its ESLint plugin, Vite Doctor extension and CLI use tinyaml's
// own API, so they build in `spec` mode, but apart from `index` so that its
// build stays the same.
const TOOLS = {
  linter: "src/linter.ts",
  doctor: "src/doctor.ts",
  eslint: "src/eslint.ts",
  cli: "src/cli.ts",
};
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const MODE = here("src/core/mode.ts");

// Doctor keeps a Rule's results between runs by its meta and `create`, so
// the Doctor extension's rules carry a hash of the code they run in their
// version: what src/doctor.ts holds as LINTER, the build replaces. A build
// whose linter or parser reads YAML another way then reuses no results.
export const LINTER = '"tinyaml-linter"';
interface Module {
  code: string | null;
  importedIds: readonly string[];
}
export const linterHash = {
  name: "tinyaml-linter-hash",
  renderChunk(
    this: { getModuleInfo(id: string): Module | null },
    code: string,
    { facadeModuleId }: { facadeModuleId: string | null },
  ) {
    if (facadeModuleId !== here("src/doctor.ts")) return null;
    const hash = createHash("sha256");
    const seen = new Set<string>();
    const add = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      // Outside modules, such as Doctor's, have no code here.
      const module = this.getModuleInfo(id);
      if (!module?.code) return;
      // Line breaks read alike in code, so a CRLF checkout hashes the same.
      hash.update(`${module.code.replace(/\r\n?/g, "\n")}\0`);
      module.importedIds.forEach(add);
    };
    add(facadeModuleId);
    return code.replaceAll(LINTER, `"${hash.digest("hex").slice(0, 16)}"`);
  },
};

export default defineConfig({
  // ESM only, with types, and publint fails the build on a broken package.json.
  // tsdown cleans once, and runs publint once all the builds are done.
  pack: [...Object.entries(MODES), ["spec", TOOLS] as const].map(([mode, entry]) => ({
    entry,
    format: ["esm"],
    platform: "neutral",
    // The CLI and the Doctor extension run in Node.
    deps: { neverBundle: [/^node:/] },
    fixedExtension: true,
    dts: true,
    clean: true,
    publint: true,
    // The parser in a module of its own: V8 runs it a few percent slower
    // in one module with the entry's code.
    outputOptions: {
      codeSplitting: { groups: [{ name: "parse", test: /src[\\/]core[\\/]parse\.ts$/ }] },
    },
    plugins: [
      linterHash,
      {
        name: "tinyaml-mode",
        async resolveId(id: string, importer: string | undefined) {
          if (!importer || !id.endsWith("mode.ts")) return null;
          const resolved = await this.resolve(id, importer, { skipSelf: true });
          return resolved?.id === MODE ? here(`src/core/mode/${mode}.ts`) : null;
        },
      },
    ],
  })),
  test: {
    include: ["test/**/*.test.ts"],
    // The conformance tests shell out to scripts that parse hundreds of files.
    testTimeout: 120_000,
  },
  staged: {
    "*": "vp check --fix",
  },
  // The fuzzers' baselines keep one record per line, for readable diffs.
  fmt: { ignorePatterns: ["**/dist/**", ".cache/**", "scripts/baselines/**"] },
  lint: {
    ignorePatterns: ["**/dist/**", ".cache/**"],
    options: { typeAware: true, typeCheck: false },
    // The loader and dumper detect control characters on purpose.
    rules: { "no-control-regex": "off" },
  },
});
