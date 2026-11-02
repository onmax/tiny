import { MESSAGES } from "./core/messages.ts";
import { at as position, parse, type Engine } from "./core/parse.ts";
import { parseAll, YAMLError } from "./index.ts";

export type Rule = "tinyaml/invalid-yaml" | "tinyaml/ambiguous-value";

export interface Diagnostic {
  rule: Rule;
  severity: "error" | "warn";
  line: number;
  column: number;
  /** 0-based, in the text. */
  offset: number;
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
      /^[-+]?(?:\d[\d_]*(?:\.[\d_]*(?:[eE][-+]\d+)?|(?::[0-5]?\d)+\.[\d_]*)|0b[01_]+|0[0-7_]+|0|[1-9][\d_]*(?::[0-5]?\d)*|0x[\da-fA-F_]+)$|^\.\d[\d_]*(?:[eE][-+]\d+)?$/,
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

// Reads `text` with the parser, which passes each plain scalar to `implicit`.
function scan(
  text: string,
  implicit: Engine["implicit"],
  error: Engine["error"] = (reason) => new Error(reason),
) {
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
      error,
    });
  } catch {}
}

// The parser's copy of `text`, which has \n for each line break and drops
// the byte order marks that start documents, and what maps positions in it,
// each no earlier than the last, to lines, columns and offsets in `text`,
// whose columns start past a byte order mark at its start, as ESLint's do.
function locator(text: string) {
  let source = "";
  // The parser makes its copy before it fails on a null byte.
  scan(`${text}\0`, String, (reason, mark) => new Error((source = mark.buffer)));
  // How far the line count got, in the copy and in `text`.
  let scanned = 0;
  let offset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let lineStart = offset;
  const dropped = () => text[offset] === "\uFEFF" && source[scanned] !== "\uFEFF";
  const locate = (to: number) => {
    for (; scanned < to || dropped(); offset++) {
      if (dropped()) continue;
      if (text[offset] === "\r" && text[offset + 1] === "\n") offset++;
      if (source[scanned++] === "\n") {
        line++;
        lineStart = offset + 1;
      }
    }
    return { line, column: offset - lineStart + 1, offset };
  };
  return [source, locate] as const;
}

// Each plain scalar without a tag that some reader reads as something else,
// as the parser reads it, with where it starts.
function plainScalars(text: string) {
  const found: ({ token: string; read: Reading } & Pick<
    Diagnostic,
    "line" | "column" | "offset"
  >)[] = [];
  const [source, locate] = locator(text);
  scan(text, (token) => {
    const read = token && reading(token);
    if (!read) return token;
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
    found.push({ token, read, ...locate(from) });
    return token;
  });
  return found;
}
type Reading = NonNullable<ReturnType<typeof reading>>;

/** Lints one YAML stream. Never throws. */
export function lint(text: string): Diagnostic[] {
  try {
    parseAll(text);
  } catch (error) {
    const [source, locate] = locator(text);
    // The error's line and column are in the parser's copy.
    let at = 0;
    if (error instanceof YAMLError) {
      for (let line = error.line; --line;) at = source.indexOf("\n", at) + 1;
      at += error.column - 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        rule: "tinyaml/invalid-yaml",
        severity: "error",
        ...locate(at),
        message: `tinyaml can't load this YAML: ${/^(.*) \(\d+:\d+\)$/.exec(message)?.[1] ?? message}.`,
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
    .map(({ token, line, column, offset, read: { name, fix, readers } }) => ({
      rule: "tinyaml/ambiguous-value",
      severity: "warn",
      line,
      column,
      offset,
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
