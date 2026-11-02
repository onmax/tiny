import { defineConfig } from "vite-plus";

export default defineConfig({
  // ESM only, for Node, with types, and publint fails the build on a broken
  // package.json. The dependencies stay outside the bundle.
  pack: {
    entry: { index: "src/index.ts", cli: "src/cli.ts" },
    format: ["esm"],
    platform: "node",
    fixedExtension: true,
    dts: true,
    clean: true,
    publint: true,
  },
  test: {
    include: ["test/**/*.test.ts"],
    // Each CLI test runs the wizard in a process of its own.
    testTimeout: 30_000,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ignorePatterns: ["**/dist/**"] },
  lint: {
    ignorePatterns: ["**/dist/**"],
    options: { typeAware: true, typeCheck: false },
  },
});
