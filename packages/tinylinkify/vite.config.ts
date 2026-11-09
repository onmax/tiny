import { defineConfig } from "vite-plus";

export default defineConfig({
  // ESM only, with types, and publint fails the build on a broken package.json.
  pack: {
    entry: {
      index: "src/index.ts",
      "linkify-it": "src/linkify-it/index.ts",
      gfm: "src/gfm/index.ts",
    },
    format: ["esm"],
    platform: "neutral",
    fixedExtension: true,
    dts: true,
    clean: true,
    publint: true,
  },
  test: {
    include: ["test/**/*.test.ts"],
    // The conformance tests shell out to scripts that run thousands of inputs.
    testTimeout: 120_000,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ignorePatterns: ["**/dist/**", ".cache/**", "test/suites/**"] },
  lint: {
    ignorePatterns: ["**/dist/**", ".cache/**", "test/suites/**"],
    options: { typeAware: true, typeCheck: false },
  },
});
