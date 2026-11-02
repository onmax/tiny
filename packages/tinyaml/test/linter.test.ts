import { parse as std } from "@std/yaml";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import js4 from "js-yaml";
import * as js5 from "js-yaml5";
import { parse as yaml } from "yaml";
import { describe, expect, it } from "vite-plus/test";
import { parseAll } from "../src/index.ts";
import { lint } from "../src/linter.ts";
import { growth } from "./fixtures.ts";

const at = (text: string) =>
  lint(text).map(({ rule, line, column }) => `${rule} ${line}:${column}`);

describe("lint", () => {
  it("reports YAML tinyaml can't load, at tinyaml's position", () => {
    expect(lint("a: 1\na: 2\n")).toEqual([
      {
        rule: "tinyaml/invalid-yaml",
        severity: "error",
        line: 2,
        column: 1,
        offset: 5,
        message: "tinyaml can't load this YAML: duplicated mapping key.",
        fix: "Fix the YAML at this position.",
      },
    ]);
  });

  it("reports plain values other readers don't read as strings", () => {
    const text = "a: yes\nb: 0b10\nc: 1_000\nd: 2026-11-01\ne: [on, off]\n";
    expect(at(text)).toEqual([
      "tinyaml/ambiguous-value 1:4",
      "tinyaml/ambiguous-value 2:4",
      "tinyaml/ambiguous-value 3:4",
      "tinyaml/ambiguous-value 4:4",
      "tinyaml/ambiguous-value 5:5",
      "tinyaml/ambiguous-value 5:9",
    ]);
    expect(lint("- no")[0]?.message).toBe(
      '`no` loads as the string "no", but PyYAML and yaml\'s YAML 1.1 schema read it as a boolean.',
    );
    expect(lint("- y")[0]?.message).toBe(
      '`y` loads as the string "y", but yaml\'s YAML 1.1 schema reads it as a boolean.',
    );
  });

  it("leaves quoted values, block scalars, and JSON values alone", () => {
    expect(
      at(
        'a: "yes"\nb: \'~\'\nc: "x, yes, y"\nd: |\n  e: yes\nf: true\ng: null\nh: 16\ni: hello # yes\n',
      ),
    ).toEqual([]);
  });

  it("uses the root API's YAML 1.2 core schema", () => {
    expect(lint('a: True\nb: ~\nc: 0x10\nd: .inf\ne: "0x10"\n')).toEqual([]);
  });

  it.each(["12:30:00", "-1:20", "+1:20", "1_000:20", "12:30:00.5", "-1:20.5"])(
    "reports YAML 1.1 sexagesimal numbers: %s",
    (value) => {
      expect(at(`duration: ${value}\n`)).toEqual(["tinyaml/ambiguous-value 1:11"]);
      expect(lint(`duration: ${value}\n`)[0]?.message).toContain("YAML 1.1 schema");
      expect(lint(`duration: "${value}"\n`)).toEqual([]);
    },
  );

  it("checks folded timestamps at their original source position", () => {
    expect(at("a: 2026-01-01\n  12:00:00\n")).toEqual(["tinyaml/ambiguous-value 1:4"]);
    expect(at("a: 2026-1-1\r\n  12:00:00\r\n")).toEqual(["tinyaml/ambiguous-value 1:4"]);
    // A blank line folds to a newline, so this is no longer a timestamp.
    expect(lint("a: 2026-01-01\n\n  12:00:00\n")).toEqual([]);
  });

  it.each([
    ['a: "no"\n# example: no\n', []],
    ['a: "yes"\n# example: yes\n', []],
    ['a: "x\n  no\n  y"\nb: no\n', ["4:4"]],
    ["a: hello\n  no\nb: no\n", ["3:4"]],
    ["a: :yes\nb: no#word\n", []],
    ['a: {"key":no}\n', ["1:11"]],
    ['a: {"it\'s": no}\n', ["1:13"]],
    ['a: ["it\'s fine", yes]\n', ["1:18"]],
    ['a: ["escaped \\" yes", no]\n', ["1:23"]],
    ["a: ['it''s yes', no]\n", ["1:18"]],
    ["- a: |\n    text\n  b: yes\n", ["3:6"]],
    ["- a: >2-\n    no\n  b: yes\n", ["3:6"]],
    ["a: &x yes\nb: *x\n", ["1:7"]],
    ["a: &x\n  no\nb: *x\n", ["2:3"]],
    ["a: !!str no\nb: no\n", ["2:4"]],
    ["a: _\nb: __\nc: +_\n", []],
    ['a: 1\nb: !!str 1\nc: "1"\n', []],
    ["1: value\n", []],
    ["a: .5\nb: -.5\nc: +.5\n", []],
    ["a: yes \n", []],
    ["a:  yes\n", []],
    ["a: yes \n", []],
    ["a:  yes\n", []],
    ["a: yes #word\n", []],
    ["a: yes \t# comment\n", ["1:4"]],
    ["? key\n: yes\n  indeed\n", []],
    ["? key\n: |2\n  no\n", []],
    ["- ? key\n  : yes\n    indeed\n", []],
    ["- ? key\n  : |2\n    no\n  next: yes\n", ["4:9"]],
    ["a: 2026-1-1 12:00:00\nb: 2026-01-01\n", ["1:4", "2:4"]],
    ["duration: 12:60:00\n", []],
    // In block context, `:` before flow punctuation doesn't end a scalar.
    ["key: a:,no\n", []],
    ["a:,no\n", []],
    // A tag on an empty node is that node's alone.
    ["[!!str\n, yes]\n", ["2:3"]],
    ["[!!str , yes]\n", ["1:10"]],
    ["{!!str : yes}\n", ["1:10"]],
    ["{!!str , yes: no}\n", ["1:10", "1:15"]],
    ["- !!str\n- yes\n", ["2:3"]],
    ["﻿a: yes\n", ["1:4"]],
    ["a: yes\n...\n﻿b: no\n", ["1:4", "3:5"]],
    // Columns in the input, past a byte order mark that starts it.
    ["a\n...\n﻿x: no", ["3:5"]],
    ["﻿a: yes\r\n...\r\n﻿# note\r\nb: [no,\r\n  no]\r\n", ["1:4", "4:5", "5:3"]],
    ["﻿no\r...\r\r﻿--- no\r", ["1:1", "4:6"]],
    ["%YAML 1.2\n---\nyes\n", ["3:1"]],
  ])("recognizes plain scalar nodes in %j", (text, positions) => {
    expect(lint(text).map(({ line, column }) => `${line}:${column}`)).toEqual(positions);
  });

  // Each problem's line, column and offset in the input, past the byte order
  // marks that start it or later documents, whatever its line breaks.
  it.each([
    ["\uFEFF@", "1:1 @"],
    ["a\n...\n\uFEFF@", "3:2 @"],
    ["a\n...\n\uFEFFx: [no, }", "3:10 }"],
    ["a\n...\n\uFEFF{x: 1, x: 2}", "3:9 x"],
    ["a\n...\n\uFEFFx: no", "3:5 no"],
    ["\uFEFFx: no\n...\n\uFEFFz: [yes, no]", "1:4 no", "3:6 yes", "3:11 no"],
  ])("places each problem in %j", (text, ...positions) => {
    for (const lines of [text, text.replaceAll("\n", "\r\n"), text.replaceAll("\n", "\r")])
      expect(
        lint(lines).map(({ line, column, offset }, i) => {
          const value = positions[i]?.split(" ")[1] ?? "";
          return `${line}:${column} ${lines.slice(offset, offset + value.length)}`;
        }),
      ).toEqual(positions);
  });

  it("returns nothing for empty input", () => {
    expect(lint("")).toEqual([]);
  });

  it.each(["[? a\n::]", "a:,%\nx", "- a\n\n\n  b\nc: d", "[a\n, b, ? c : d]\n"])(
    "never throws, and reports what parseAll throws on, for every prefix of %j",
    (text) => {
      for (let end = 0; end <= text.length; end++) {
        const prefix = text.slice(0, end);
        let throws = false;
        try {
          parseAll(prefix);
        } catch {
          throws = true;
        }
        expect(lint(prefix).some(({ rule }) => rule === "tinyaml/invalid-yaml")).toBe(throws);
      }
    },
  );

  it.each([
    ["the blank lines in a scalar", (n: number) => [`a${"\n".repeat(n)} b`, 0] as const],
    ["the values on a line", (n: number) => [`[${"no,".repeat(n - 1)}no]`, n] as const],
    ["the lines", (n: number) => ["- no\n".repeat(n), n] as const],
  ])(
    "takes time linear in %s",
    (_, make) => {
      const [text, problems] = make(10_000);
      expect(lint(text)).toHaveLength(problems);
      // Keep the eightfold comparison, with enough values to measure scaling
      // without creating millions of diagnostics on a busy CI runner.
      expect(growth((n) => make(n)[0], lint, 10_000)).toBeLessThan(32);
    },
    30_000,
  );
});

// The readers each message names are those that don't read the value as a
// string, PyYAML included where Python has it.
describe("ambiguous-value readers", () => {
  const values = [
    ..."y Y n N yes Yes YES no No NO on On ON off OFF oN yEs _ __ +_ hello e3 E5 e+1 .e3 -e3".split(
      " ",
    ),
    ..."0o 0x 0b 0b2 0o1_7 -0o1_7 1e3_0 0b10 -0b10 +0b1 0b1_0 0b_ -0x10 +0x1F 0x1_F 0x_1 0x_".split(
      " ",
    ),
    ..."-0o17 +0o7 0_ 0_1 00_7 08_1 1_ 1__0 1_000 -1_000 +1_0 1_0.5 1_0e3 1_e3 1_0.5e+3".split(" "),
    ..."0.1_ .1_0 ._5 -.1_0 +._5 -._5 . -. 1:20 -1:20 0:20 12:30:00 12:60:00 190:20:30".split(" "),
    ..."1_000:20 1:20.5 1:2_0 1:20.5e+1 -1:20.E-1 1:20e+1 2026-11-01 2026-1-1 2026-01-1".split(" "),
    "2026-13-01",
    "2026-01-01T12:00:00Z",
    "2026-01-01 12:00:00",
    "2026-1-1 1:2:3",
    "2026-1-1 12:00:00",
    "2026-01-01t12:00:00.5 +01:00",
    "2026-01-01 12:00",
  ];
  // Number-like values tinyaml reads as strings: signs, bases, underscores,
  // sexagesimal parts, fractions, exponents, .inf and .nan, some with a
  // character added, dropped or replaced.
  let seed = 1;
  const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
  const pick = (choices: string) => {
    const list = choices.split(" ");
    return list[random(list.length)]!;
  };
  const generated = new Set<string>();
  for (let n = 0; n < 4000; n++) {
    let value =
      pick("  + -") +
      pick(
        " 0 1 7 8 00 01 08 1_0 1__0 0_ _ _1 12 190 0b1_0 0b 0b2 0b_ 0x1F 0x_ 0x 0xg 0o17 0o 0o8",
      ) +
      pick("    :5 :59 :60 :0_ : :5:30 :5_ :1:2") +
      (random(6)
        ? pick("   . .5 ._ .5_ .0_1 .e") + pick("    e3 e+3 E-1 e e_1 e+ E+3_")
        : pick(".inf .Inf .INF .iNf .nan .NaN .NAN .naN inf nan"));
    for (let edits = random(3) ? 0 : 1 + random(2); edits--;) {
      const at = random(value.length + 1);
      const op = random(3);
      value =
        value.slice(0, at) +
        (op ? "0189_:.eE+-xboaF"[random(16)] : "") +
        value.slice(op === 1 ? at : at + 1);
    }
    try {
      if (isDeepStrictEqual(parseAll(`${value}\n---\n- ${value}`), [value, [value]]))
        generated.add(value);
    } catch {}
  }
  const kind = (value: unknown) =>
    value instanceof Date ? "date" : typeof value === "string" ? "" : typeof value;
  // PyYAML's type for each value, "error" where it fails.
  const python = (() => {
    const all = [...values, ...generated];
    const script = `import sys, json, yaml
out = []
for t in json.load(sys.stdin):
    try:
        out.append(type(yaml.safe_load(t)).__name__)
    except Exception:
        out.append("error")
print(json.dumps(out))`;
    try {
      const types: string[] = JSON.parse(
        execFileSync("python3", ["-I", "-c", script], {
          input: JSON.stringify(all),
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        }),
      );
      return new Map(all.map((value, i) => [value, types[i]!]));
    } catch {
      return undefined;
    }
  })();
  const PYTHON: Record<string, string> = {
    str: "",
    bool: "boolean",
    int: "number",
    float: "number",
    error: "error",
  };
  const readers: [string, ((value: string) => string) | undefined][] = [
    ["js-yaml 4", (value) => kind(js4.load(value))],
    ["@std/yaml", (value) => kind(std(value))],
    // PyYAML fails on some values it reads as a number or a date.
    ["PyYAML", python && ((value) => PYTHON[python.get(value)!] ?? "date")],
    ["yaml's YAML 1.1 schema", (value) => kind(yaml(value, { version: "1.1" }))],
  ];

  it.each(values)("names the readers that don't read %j as a string", (value) => {
    expect(parseAll(value)).toEqual([value]);
    expect(js5.load(value)).toBe(value);
    expect(yaml(value)).toBe(value);
    const message = lint(`- ${value}\n`)[0]?.message;
    const differ = readers.flatMap(([name, read]) => {
      const reads = read?.(value);
      return reads ? [{ name, reads }] : [];
    });
    expect(
      readers.filter(([name, read]) => read && message?.includes(name)).map(([name]) => name),
    ).toEqual(differ.map(({ name }) => name));
    if (!differ.length) return;
    const kinds = new Set(differ.map(({ reads }) => reads).filter((reads) => reads !== "error"));
    expect([...kinds]).toHaveLength(1);
    expect(message).toMatch(` it as a ${[...kinds][0]}.`);
  });

  it(`names the readers that don't read ${generated.size} generated numbers as strings`, () => {
    const wrong = [...generated].filter((value) => {
      const message = lint(`- ${value}\n`)[0]?.message;
      return (
        js5.load(value) !== value ||
        yaml(value) !== value ||
        (message !== undefined && !message.endsWith(" it as a number.")) ||
        readers.some(([name, read]) => read && !!message?.includes(name) !== !!read(value))
      );
    });
    expect(wrong).toEqual([]);
  });
});
