// Reading takes time linear in the input, whatever the input repeats: byte
// order marks, null bytes, carriage returns, document markers, directives
// and comments, which the parser or an entry once handled with a copy or a
// search from the start for each one. Each shape runs against every entry
// that reads it to the end; yaml's `parse` stops at a second document.
import { describe, expect, it } from "vite-plus/test";
import { parseAll } from "../src/index.ts";
import * as jsYaml from "../src/js-yaml/index.ts";
import * as jsYaml5 from "../src/js-yaml-v5/index.ts";
import { lint } from "../src/linter.ts";
import * as std from "../src/std/index.ts";
import * as yaml from "../src/yaml/index.ts";
import yamljs from "../src/yamljs/index.ts";
import { growth } from "./fixtures.ts";

const ENTRIES: Record<string, (text: string) => unknown> = {
  tinyaml: parseAll,
  "tinyaml/js-yaml": (text) => jsYaml.loadAll(text),
  "tinyaml/js-yaml-v5": (text) => jsYaml5.loadAll(text),
  "tinyaml/yaml": (text) => yaml.parse(text, { logLevel: "silent" }),
  "tinyaml/yamljs": (text) => yamljs.parse(text),
  // std and yaml warn as they read.
  "tinyaml/std": (text) => std.parseAll(text, { onWarning() {} }),
  linter: lint,
};
const MULTIPLE = Object.keys(ENTRIES).filter((entry) => entry !== "tinyaml/yaml");

const B = "﻿";
// Each shape, `n` times, and the entries that read it to the end.
const SHAPES: [string, (n: number) => string, string[]?][] = [
  ["byte order marks after `...`", (n) => `${B}a: b c\n...\n`.repeat(n), MULTIPLE],
  ["byte order marks before `---`", (n) => `${B}--- a\n...\n`.repeat(n), MULTIPLE],
  ["byte order marks before a comment and `---`", (n) => `a\n${B}# c\n---\n`.repeat(n), MULTIPLE],
  ["byte order marks in scalars", (n) => `- a${B}b\n`.repeat(n)],
  ["byte order marks in comments", (n) => `- a # c${B}\n`.repeat(n)],
  ["byte order marks that start lines", (n) => `- "a\n  ${B}b"\n`.repeat(n)],
  // The others reject a null byte before they read the input.
  ["null bytes", (n) => `- a\0b\n`.repeat(n), ["tinyaml/yaml", "tinyaml/yamljs"]],
  ["lines before a null byte", (n) => `${"- a\n".repeat(n)}\0`],
  ["CRLF line breaks", (n) => `- a\r\n`.repeat(n)],
  ["CR line breaks", (n) => `- a\r`.repeat(n)],
  ["`---` markers", (n) => `---\na\n`.repeat(n), MULTIPLE],
  ["`...` markers", (n) => `a\n...\n`.repeat(n), MULTIPLE],
  ["empty documents", (n) => `${"...\n".repeat(n)}a\n`, MULTIPLE],
  ["%YAML directives", (n) => `%YAML 1.2\n---\na\n...\n`.repeat(n), MULTIPLE],
  ["%TAG directives", (n) => `%TAG !e! tag:x,2000:\n--- !e!a b\n...\n`.repeat(n), MULTIPLE],
  ["unknown directives, each a warning", (n) => `${"%FOO bar # c\n".repeat(n)}---\na\n`],
  ["comment lines", (n) => `${"# c\n".repeat(n)}a\n`],
  // yamljs reads the input again, quoted, after the `@` fails it.
  [
    "indented comments and blank lines",
    (n) => `a: @b\n${"  # c\n\n".repeat(n)}`,
    ["tinyaml/yamljs"],
  ],
  ["trailing comments", (n) => `- a # c\n`.repeat(n)],
  ["lines before an error", (n) => `${"- a\n".repeat(n)}]`],
];

describe.each(SHAPES)("reading %s", (_, text, entries = Object.keys(ENTRIES)) => {
  it.each(entries)("takes linear time in %s", (entry) => {
    const read = (input: string) => {
      try {
        return ENTRIES[entry]!(input);
      } catch (error) {
        return error;
      }
    };
    expect(growth(text, read, 1000)).toBeLessThan(32);
  });
});
