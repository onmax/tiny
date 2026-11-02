// Reading takes time linear in the input, whatever the input repeats: byte
// order marks, null bytes, carriage returns, document markers, directives,
// comments, keys, warnings and white space, which the parser or an entry once
// handled with a copy or a search from the start, of the input or the line,
// for each one. Each shape runs against every entry that reads it to the end;
// yaml's `parse` stops at a second document.
import { describe, expect, it } from "vite-plus/test";
import { parseAll } from "../src/index.ts";
import * as jsYaml from "../src/js-yaml/index.ts";
import * as jsYaml5 from "../src/js-yaml-v5/index.ts";
import { lint } from "../src/linter.ts";
import * as std from "../src/std/index.ts";
import * as yaml from "../src/yaml/index.ts";
import yamljs from "../src/yamljs/index.ts";
import { LINEAR, slope } from "./fixtures.ts";

type Read = (text: string) => unknown;
const ENTRIES: Record<string, Read> = {
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
// Each shape, `n` times, the entries that read it to the end, or how each
// entry that reads it does, where that takes options, and the characters to
// start from, where the work that grows with the square of them is too quick
// to show over the rest at the usual 16,000.
const SHAPES: [string, (n: number) => string, (string[] | Record<string, Read>)?, number?][] = [
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
  // A document parsed inside another, while it warns.
  [
    "unknown directives, each a warning that parses a document",
    (n) => `${"%FOO bar\n".repeat(n)}---\na\n`,
    { "tinyaml/std": (text) => std.parseAll(text, { onWarning: () => std.parse("x") }) },
  ],
  [
    "unknown tags, each a warning, between tags that parse a document",
    (n) => `- !x a\n- !foo b\n`.repeat(n),
    {
      "tinyaml/yaml": (text) =>
        yaml.parse(text, {
          logLevel: "silent",
          customTags: [{ tag: "!x", resolve: () => yaml.parse("x") }],
        }),
    },
  ],
  [
    "unknown tags on one line, each a warning",
    (n) => `[${"!foo a, ".repeat(n)}]`,
    {
      "tinyaml/yaml": ENTRIES["tinyaml/yaml"]!,
      "tinyaml/yaml without prettyErrors": (text) =>
        yaml.parse(text, { logLevel: "silent", prettyErrors: false }),
    },
  ],
  ["values others read otherwise, on one line", (n) => `[${"yes, ".repeat(n)}]`, { linter: lint }],
  [
    "repeated keys where they may repeat",
    (n) => "a: x\n".repeat(n),
    {
      tinyaml: (text) => parseAll(text, { duplicateKeys: true }),
      "tinyaml/js-yaml": (text) => jsYaml.loadAll(text, null, { json: true }),
      "tinyaml/js-yaml-v5": (text) => jsYaml5.loadAll(text, null, { json: true }),
      "tinyaml/yaml": (text) => yaml.parse(text, { logLevel: "silent", uniqueKeys: false }),
      "tinyaml/yamljs": ENTRIES["tinyaml/yamljs"]!,
      "tinyaml/std": (text) => std.parseAll(text, { allowDuplicateKeys: true }),
    },
  ],
  [
    "repeated keys that share a name",
    (n) => `1: x\n"1": y\n`.repeat(n),
    { "tinyaml/yaml": (text) => yaml.parse(text, { logLevel: "silent", uniqueKeys: false }) },
  ],
  // js-yaml 5 measures the line's indentation at each tab.
  ["tabs in flow after deep indentation", (n) => `${"  ".repeat(n)}[${"a,\t".repeat(n)}a]`],
  // yamljs takes other white space after a `:` on a key's line.
  ["no-break spaces after `:`", (n) => `a: x${":\u00a0x".repeat(n)}`, undefined, 64_000],
  [
    "no-break spaces after `:`, then a line separator",
    (n) => `a: x${":\u00a0x".repeat(n)}\u2028y`,
    undefined,
    64_000,
  ],
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

describe.each(SHAPES)("reading %s", (_, text, entries = Object.keys(ENTRIES), chars) => {
  const reads = Array.isArray(entries)
    ? entries.map((entry): [string, Read] => [entry, ENTRIES[entry]!])
    : Object.entries(entries);
  it.each(reads)("takes linear time in %s", (_, read) => {
    const settle = (input: string) => {
      try {
        return read(input);
      } catch (error) {
        return error;
      }
    };
    expect(slope(text, settle, chars)).toBeLessThan(LINEAR);
  });
});
