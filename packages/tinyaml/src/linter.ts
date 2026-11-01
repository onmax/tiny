import { MESSAGES } from "./core/messages.ts";
import { at as position, parse, where } from "./core/parse.ts";
import { parseAll } from "./index.ts";

export type Rule = "tinyaml/invalid-yaml" | "tinyaml/ambiguous-value";

export interface Diagnostic {
  rule: Rule;
  severity: "error" | "warn";
  line: number;
  column: number;
  message: string;
  fix: string;
}

export interface RuleInfo {
  code: string;
  title: string;
  severity: "error" | "warn";
}

export const rules: Record<Rule, RuleInfo> = {
  "tinyaml/invalid-yaml": {
    code: "TINYAML0001",
    title: "YAML that tinyaml can't load",
    severity: "error",
  },
  "tinyaml/ambiguous-value": {
    code: "TINYAML0002",
    title: "A plain value other YAML readers don't read as a string",
    severity: "warn",
  },
};

const DATE =
  /^\d{4}-\d\d-\d\d$|^\d{4}-\d\d?-\d\d?(?:[Tt]|[ \t]+)\d\d?:\d\d:\d\d(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d\d)?))?$/;

// What other readers make of a plain scalar: each one's patterns, from its
// source, for what it reads as a boolean, a number or a date. PyYAML then
// fails on some, such as `0x_` and `2026-13-01`. Of the values tinyaml reads
// as strings, js-yaml 5 and yaml's default YAML 1.2 schema read every one as
// a string too.
const READERS: [string, (RegExp | undefined)[]][] = [
  ["js-yaml 4", [undefined, /^[-+]?0b[01]+$|^[-+]0(?:x[\da-fA-F]+|o[0-7]+)$/, DATE]],
  [
    "@std/yaml",
    [
      undefined,
      /^[-+]?0(?:b[01_]*[01]|x[\da-fA-F_]*[\da-fA-F]|[0-7_]*[0-7])$|^(?:[-+]?(?:0|[1-9][\d_]*)(?:\.[\d_]*)?(?:[eE][-+]?\d+)?|\.[\d_]+(?:[eE][-+]?\d+)?)$(?<!_)/,
      DATE,
    ],
  ],
  [
    "PyYAML",
    [
      /^(?:yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$/,
      /^[-+]?(?:\d[\d_]*(?::[0-5]?\d)*\.[\d_]*(?:[eE][-+]\d+)?|0b[01_]+|0[0-7_]+|0|[1-9][\d_]*(?::[0-5]?\d)*|0x[\da-fA-F_]+)$|^\.\d[\d_]*(?:[eE][-+]\d+)?$/,
      DATE,
    ],
  ],
  [
    "yaml's YAML 1.1 schema",
    [
      /^(?:[yYnN]|[Yy]es|YES|[Nn]o|NO|[Oo]n|ON|[Oo]ff|OFF)$/,
      /^[-+]?(?:0b[01_]+|0x[\da-fA-F_]+|\d[\d_]*(?::[0-5]?\d)*(?:\.[\d_]*)?|(?:\d[\d_]*)?(?:\.[\d_]*)?[eE][-+]?\d+|\.[\d_]*)$/,
      /^\d{4}-\d\d?-\d\d?(?:(?:[Tt]|[ \t]+)\d\d?:\d\d?:\d\d?(?:\.\d+)?(?:[ \t]*(?:Z|[-+][012]?\d(?::\d\d)?))?)?$/,
    ],
  ],
];
// Each kind of value in READERS' patterns, with the fix.
const KINDS: [string, string][] = [
  ["boolean", "Quote it to keep the string, or write `true` or `false`."],
  ["number", "Quote it to keep the string, or write it as a JSON number."],
  ["date", "Quote it so every reader gets the same string."],
];
const names = new Intl.ListFormat("en");

const blank = (ch: string | undefined) => ch === " " || ch === "\t" || ch === "\n";

// The readers that read `token` as something else, what as, and the fix.
function reading(token: string) {
  // What each pattern starts with.
  if (!/^[-+.\deEnoyNOY]/.test(token)) return;
  for (const [kind, [name, fix]] of KINDS.entries()) {
    const readers = READERS.filter(([, patterns]) => patterns[kind]?.test(token));
    if (readers.length) return { name, fix, readers: readers.map(([reader]) => reader) };
  }
}

// Each plain scalar without a tag that some reader reads as something else,
// as the parser reads it, with where it starts.
function plainScalars(text: string) {
  const found: { token: string; line: number; column: number; read: Reading }[] = [];
  let source = "";
  let line = 1;
  let lineStart = 0;
  const implicit = (token: string | null) => {
    const read = token && reading(token);
    if (!read) return token;
    // Where the parser reads, in its copy of the input.
    source ||= where()!.buffer;
    // The parser is past the scalar, and maybe the blanks after it. The
    // scalar is the source's text with only the blanks inside it folded.
    let from = position();
    while (blank(source[from - 1])) from--;
    for (let i = token.length; i;)
      if (!blank(token[i - 1])) {
        if (token[--i] !== source[--from]) return token;
      } else {
        while (blank(token[i - 1])) i--;
        while (blank(source[from - 1])) from--;
      }
    for (let end; (end = source.indexOf("\n", lineStart)) >= 0 && end < from; line++)
      lineStart = end + 1;
    found.push({ token, line, column: from - lineStart + 1, read });
    return token;
  };
  try {
    parse(text, {
      tag: "",
      messages: MESSAGES,
      spec: true,
      json: true,
      implicit,
      explicit: (value) => value,
      key: String,
      verbatim() {},
      error: (reason) => new Error(reason),
    });
  } catch {}
  return found;
}
type Reading = NonNullable<ReturnType<typeof reading>>;

/** Lints one YAML stream. Never throws. */
export function lint(text: string): Diagnostic[] {
  try {
    parseAll(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const at = /^(.*) \((\d+):(\d+)\)$/.exec(message);
    return [
      {
        rule: "tinyaml/invalid-yaml",
        severity: "error",
        line: at ? Number(at[2]) : 1,
        column: at ? Number(at[3]) : 1,
        message: `tinyaml can't load this YAML: ${at?.[1] ?? message}.`,
        fix: "Fix the YAML at this position.",
      },
    ];
  }

  const found = plainScalars(text);
  // The patterns match some values tinyaml reads as numbers too. It reads
  // them all at once, as a sequence.
  const values = found.length
    ? (parseAll(found.map(({ token }) => `- ${token}`).join("\n"))[0] as unknown[])
    : [];
  return found
    .filter((_, i) => typeof values[i] === "string")
    .map(({ token, line, column, read: { name, fix, readers } }) => ({
      rule: "tinyaml/ambiguous-value",
      severity: "warn",
      line,
      column,
      message: `\`${token}\` loads as the string "${token}", but ${names.format(readers)} read${readers.length > 1 ? "" : "s"} it as a ${name}.`,
      fix,
    }));
}

export interface LintedFile {
  file: string;
  /** `undefined` when the file can't be read. */
  text?: string;
  diagnostics: Diagnostic[];
}

/** Lints each file, reading it with `read`. */
export async function lintFiles(
  files: readonly string[] | AsyncIterable<string> | Iterable<string>,
  read: (file: string) => string | undefined | Promise<string | undefined>,
): Promise<LintedFile[]> {
  const results: LintedFile[] = [];
  for await (const file of files) {
    const text = await read(file);
    results.push({ file, text, diagnostics: text === undefined ? [] : lint(text) });
  }
  return results;
}
