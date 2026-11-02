import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  byName,
  EXPORTS,
  LIBRARIES,
  libraryOf,
  parseVersion,
  pickRange,
} from "../src/libraries.ts";

describe("EXPORTS", () => {
  // Each drop-in's entry is src/<subpath>/index.ts in its package.
  it.each(Object.keys(EXPORTS))("lists what %s exports", async (target) => {
    const [tiny, subpath] = target.split("/");
    const manifest = JSON.parse(readFileSync(`../${tiny}/package.json`, "utf8")) as {
      exports: Record<string, string>;
    };
    expect(manifest.exports[`./${subpath}`]).toBe(`./dist/${subpath}.mjs`);
    const source = new URL(`../../${tiny}/src/${subpath}/index.ts`, import.meta.url).href;
    expect(EXPORTS[target]).toEqual(Object.keys((await import(source)) as object).sort());
  });

  it("covers every subpath a version picks", () => {
    const versions = [
      "0.1.0",
      "0.2.0",
      "0.3.0",
      "1.0.0",
      "2.0.0",
      "3.0.0",
      "4.0.0",
      "4.1.0",
      "5.0.0",
      "7.0.0",
    ];
    const targets = LIBRARIES.flatMap((library) =>
      versions.map((version) => library.pick(parseVersion(version)!)).filter(Boolean),
    );
    expect(new Set(targets)).toEqual(new Set(Object.keys(EXPORTS)));
  });
});

const pick = (name: string, version: string) => byName.get(name)!.pick(parseVersion(version)!);

describe("parseVersion", () => {
  it("reads the first version in a version or range", () => {
    expect(parseVersion("4.1.0")).toEqual({ major: 4, minor: 1, patch: 0 });
    expect(parseVersion("^2.2.3")).toEqual({ major: 2, minor: 2, patch: 3 });
    expect(parseVersion("~0.3.0")).toEqual({ major: 0, minor: 3, patch: 0 });
    expect(parseVersion("4.x")).toEqual({ major: 4, minor: 0, patch: 0 });
    expect(parseVersion(">=1.3.8 <2")).toEqual({ major: 1, minor: 3, patch: 8 });
    expect(parseVersion("npm:js-yaml@^4.1.0")).toEqual({ major: 4, minor: 1, patch: 0 });
    expect(parseVersion("jsr:^1.0.5")).toEqual({ major: 1, minor: 0, patch: 5 });
  });

  it("finds none in a tag, a path or a workspace range", () => {
    expect(parseVersion("latest")).toBeUndefined();
    expect(parseVersion("*")).toBeUndefined();
    expect(parseVersion("workspace:*")).toBeUndefined();
    expect(parseVersion("file:../js-yaml")).toBeUndefined();
  });
});

describe("pick", () => {
  it.each([
    ["js-yaml", "4.1.0", "tinyaml/js-yaml"],
    ["js-yaml", "5.0.0", "tinyaml/js-yaml-v5"],
    ["js-yaml", "3.14.1", undefined],
    ["yaml", "2.8.0", "tinyaml/yaml"],
    ["yaml", "1.10.2", undefined],
    ["yamljs", "0.3.0", "tinyaml/yamljs"],
    ["yamljs", "0.2.10", undefined],
    ["@std/yaml", "1.0.5", "tinyaml/std"],
    ["json5", "2.2.3", "tinyjson5/json5"],
    ["json5", "1.0.2", "tinyjson5/json5-v1"],
    ["strip-json-comments", "2.0.1", "tinyjson5/strip-json-comments-v2"],
    ["strip-json-comments", "3.1.1", "tinyjson5/strip-json-comments"],
    ["strip-json-comments", "4.0.0", undefined],
    ["strip-json-comments", "5.0.3", "tinyjson5/strip-json-comments-v5"],
    ["jsonc-parser", "3.3.1", "tinyjson5/jsonc-parser"],
    ["comment-json", "4.2.5", "tinyjson5/comment-json"],
    ["jju", "1.4.0", "tinyjson5/jju"],
    ["ini", "1.3.8", "tinyini/ini-v1"],
    ["ini", "2.0.0", "tinyini/ini-v2"],
    ["ini", "3.0.1", "tinyini/ini-v2"],
    ["ini", "4.0.0", "tinyini/ini-v2"],
    ["ini", "4.1.3", "tinyini/ini"],
    ["ini", "7.0.0", "tinyini/ini"],
    ["ini", "8.0.0", undefined],
    ["@one-ini/wasm", "0.1.1", "tinyini/one-ini-v0.1"],
    ["@one-ini/wasm", "0.2.1", "tinyini/one-ini"],
  ])("%s %s → %s", (name, version, target) => {
    expect(pick(name, version)).toBe(target);
  });
});

describe("pickRange", () => {
  const range = (name: string, text: string) => pickRange(byName.get(name)!, text);

  it.each([
    ["js-yaml", "^4.1.0", "tinyaml/js-yaml"],
    ["js-yaml", "~5.0.0", "tinyaml/js-yaml-v5"],
    ["js-yaml", "4.x", "tinyaml/js-yaml"],
    ["js-yaml", "4", "tinyaml/js-yaml"],
    ["js-yaml", "=4.1.0", "tinyaml/js-yaml"],
    ["js-yaml", ">=4.0.0 <5.0.0", "tinyaml/js-yaml"],
    ["js-yaml", "npm:js-yaml@^4.1.0", "tinyaml/js-yaml"],
    ["js-yaml", "^3.14.0", undefined],
    ["js-yaml", "<4", null],
    ["js-yaml", ">=4", null],
    ["js-yaml", "^4.0.0 || ^5.0.0", null],
    ["js-yaml", "latest", null],
    ["ini", "^4.0.0", null],
    ["ini", "~4.0.0", "tinyini/ini-v2"],
    ["ini", "^4.1.3", "tinyini/ini"],
    ["ini", ">=1.3.8 <2", "tinyini/ini-v1"],
    ["yamljs", "^0.3.0", "tinyaml/yamljs"],
    ["@one-ini/wasm", "^0.2.0", "tinyini/one-ini"],
    ["@std/yaml", "jsr:^1.0.5", "tinyaml/std"],
  ])("%s %s → %s", (name, text, target) => {
    expect(range(name, text)).toBe(target);
  });
});

describe("libraryOf", () => {
  it("matches a library's name and its subpaths, and nothing that only starts like it", () => {
    expect(libraryOf("yaml")).toMatchObject({ library: { name: "yaml" }, subpath: "" });
    expect(libraryOf("yaml/util")).toMatchObject({ library: { name: "yaml" }, subpath: "util" });
    expect(libraryOf("@std/yaml/parse")).toMatchObject({
      library: { name: "@std/yaml" },
      subpath: "parse",
    });
    expect(libraryOf("yaml-front-matter")).toBeUndefined();
    expect(libraryOf("./yaml")).toBeUndefined();
    expect(libraryOf("tinyaml/yaml")).toBeUndefined();
  });
});
