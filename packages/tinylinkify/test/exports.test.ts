// Each entry in package.json's exports loads and exports what it should.
// Under test:dist, these are the built files npm ships.
import { describe, expect, it } from "vite-plus/test";

const entries: [string, () => Promise<Record<string, any>>, string[]][] = [
  ["tinylinkify", () => import("../src/index.ts"), ["find", "test"]],
  ["tinylinkify/gfm", () => import("../src/gfm/index.ts"), ["LinkifyIt", "default"]],
  [
    "tinylinkify/linkify-it",
    () => import("../src/linkify-it/index.ts"),
    ["default", "module.exports"],
  ],
];

describe("exports", () => {
  for (const [name, load, names] of entries)
    it(name, async () => {
      expect(Object.keys(await load()).sort()).toEqual(names);
    });
});
