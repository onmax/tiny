// The differences a fuzzer is known to find, or a suite check accepts, kept
// one by one in scripts/baselines/<check>.json. Each record names an input
// and its options by a hash, the iteration that first generated it, the
// kind of difference, and each side's outcome. A run fails on a difference
// that has no record, on a record whose outcome changed, and on a record
// within the run's iterations that no longer turns up. Records are kept per
// seed (and mode), and a shorter run checks the records its iterations
// reach, since a seed's first N inputs are the same however many follow.
//
// A run with --update rewrites its seed's records to what it found, and
// prints what it added, removed and changed; `git diff scripts/baselines`
// shows the same, one record per line. Review it before committing.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fail, ownKeys } from "./support.ts";

/** One known difference: which input, and what each side did with it. */
export interface Difference {
  /** The iteration that first generated the input. */
  at: number;
  /** A hash of the input and its options. */
  id: string;
  kind: string;
  options?: unknown;
  /** Each side's outcome, by library name. */
  sides: Record<string, string>;
  /** The input's start, to recognise it by. */
  input: string;
}

interface Run {
  iterations: number;
  differences: Difference[];
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** The positional arguments, without --update. */
export const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const update = process.argv.includes("--update");

/**
 * Text for a value that tells apart what equal() in support.ts does, so
 * two values have the same text exactly when they're equal: types,
 * prototypes, key order, holes, -0, bigints, symbols, functions, Dates,
 * boxed primitives, RegExps and errors, buffers' bytes, Maps and Sets, the
 * own enumerable keys of every object, and which objects are the same: an
 * object found at more than one place is written once, after `&1`, and as
 * `*1` at each place after. Longer than 100 characters, it's cut to 80 and
 * a hash of the whole.
 */
export function describe(value: unknown): string {
  return shorten(serialize(value, { shared: repeated(value), ids: new Map() }));
}

interface Refs {
  /** The objects found at more than one place. */
  shared: Set<object>;
  /** Those written so far, by their number. */
  ids: Map<object, number>;
}

// An array's or typed array's own keys that are indexes, which its items cover.
const index = (value: { length: number }, key: string | symbol) =>
  typeof key === "string" && /^(?:0|[1-9]\d*)$/.test(key) && +key < value.length;

// The own keys serialize writes after an object's items or contents.
function extraKeys(value: object): (string | symbol)[] {
  const keys = ownKeys(value);
  if (Array.isArray(value) || ArrayBuffer.isView(value) || value instanceof String)
    return keys.filter((key) => !index(value as { length: number }, key));
  return keys;
}

// The objects reachable from `value` by more than one path.
function repeated(value: unknown): Set<object> {
  const seen = new Set<object>();
  const shared = new Set<object>();
  const stack = [value];
  while (stack.length) {
    const x = stack.pop();
    if (typeof x !== "object" || x === null) continue;
    if (seen.has(x)) {
      shared.add(x);
      continue;
    }
    seen.add(x);
    if (x instanceof Map) for (const entry of x) stack.push(...entry);
    else if (x instanceof Set) stack.push(...x);
    for (const key of extraKeys(x)) stack.push((x as never)[key]);
    if (Array.isArray(x)) stack.push(...x);
  }
  return shared;
}

// Symbols, functions and prototypes, which only their identity tells apart,
// by their text and, from the second of the same text this process
// describes, a number: `Symbol("a")`, then `Symbol("a")#2`.
const labels = new Map<string, unknown[]>();
function label(thing: unknown, text: string, first?: unknown): string {
  let things = labels.get(text);
  if (!things) labels.set(text, (things = first === undefined ? [] : [first]));
  let n = things.indexOf(thing);
  if (n < 0) n = things.push(thing) - 1;
  return n ? `${text}#${n + 1}` : text;
}

// A prototype by its constructor's name; a global's prototype comes first.
function prototype(proto: object): string {
  const constructor = Object.hasOwn(proto, "constructor") ? proto.constructor : undefined;
  const name =
    typeof constructor === "function" && constructor.name ? constructor.name : "(anonymous)";
  const global: unknown = Reflect.get(globalThis, name);
  return label(proto, name, typeof global === "function" ? global.prototype : undefined);
}

/**
 * Text for an error: its first line, cut as describe cuts, and for a message
 * of more lines, a hash of the whole, so a change to any line shows.
 */
export function describeError(message: string): string {
  const first = message.split("\n")[0]!;
  const text = shorten(`! ${first}`);
  return first === message ? text : `${text} ¶${hash(message).slice(0, 12)}`;
}

/** `text`, or longer than 100 characters, its first 80 and a hash of the whole. */
export function shorten(text: string): string {
  return text.length > 100 ? `${text.slice(0, 80)}… #${hash(text).slice(0, 12)}` : text;
}

function serialize(value: unknown, refs: Refs): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value === "symbol") {
    const key = Symbol.keyFor(value);
    if (key !== undefined) return `Symbol.for(${JSON.stringify(key)})`;
    const text = value.description === undefined ? "" : JSON.stringify(value.description);
    return label(value, `Symbol(${text})`);
  }
  if (typeof value === "function")
    return label(value, `Function(${JSON.stringify(String(value))})`);
  if (typeof value !== "object" || value === null) return String(value);
  const id = refs.ids.get(value);
  if (id) return `*${id}`;
  let anchor = "";
  if (refs.shared.has(value)) {
    refs.ids.set(value, refs.ids.size + 1);
    anchor = `&${refs.ids.size} `;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  const name = proto === null ? "[null]" : proto === Object.prototype ? "" : prototype(proto);
  // Written after the items or contents, so anchors number in reading order.
  const fields = () =>
    extraKeys(value).map(
      (key) =>
        `${typeof key === "symbol" ? serialize(key, refs) : JSON.stringify(key)}:${serialize((value as never)[key], refs)}`,
    );
  let text: string;
  if (Array.isArray(value)) {
    const items = Array.from({ length: value.length }, (_, i) =>
      i in value ? serialize(value[i], refs) : "<hole>",
    );
    return `${anchor}${proto === Array.prototype ? "" : name}[${[...items, ...fields()].join(",")}]`;
  }
  if (
    value instanceof Date ||
    value instanceof Number ||
    value instanceof String ||
    value instanceof Boolean ||
    value instanceof BigInt ||
    value instanceof Symbol
  ) {
    const primitive = value.valueOf();
    text =
      value instanceof Date
        ? Number.isNaN(primitive)
          ? "Invalid"
          : value.toISOString()
        : serialize(primitive, refs);
  } else if (value instanceof RegExp || value instanceof Error)
    text = JSON.stringify(String(value));
  else if (ArrayBuffer.isView(value))
    text = Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("hex");
  else if (value instanceof ArrayBuffer) text = Buffer.from(value).toString("hex");
  else if (value instanceof Map)
    text = `{${[...value].map(([k, v]) => `${serialize(k, refs)}=>${serialize(v, refs)}`).join(",")}}`;
  else if (value instanceof Set) text = `[${[...value].map((v) => serialize(v, refs)).join(",")}]`;
  else return `${anchor}${name}{${fields().join(",")}}`;
  // Maps and Sets write their contents in brackets of their own.
  if (!(value instanceof Map || value instanceof Set)) text = `(${text})`;
  const extra = fields();
  return `${anchor}${name}${text}${extra.length ? `{${extra.join(",")}}` : ""}`;
}

/**
 * The known differences of one fuzzer's run: `name` is its baseline file,
 * `run` its seed and mode, as in "seed 1" or "seed 1, schemas". A suite
 * check counts its cases as iterations.
 */
export class Baseline {
  readonly found = new Map<string, Difference>();
  readonly file: string;
  readonly run: string;
  readonly iterations: number;
  /** Each found input in full, to print for a new or changed record. */
  private inputs = new Map<string, string>();
  constructor(name: string, run: string, iterations: number) {
    this.run = run;
    this.iterations = iterations;
    this.file = new URL(`baselines/${name}.json`, import.meta.url).pathname;
  }

  /**
   * Records a difference at iteration `at`. An input seen before is skipped,
   * and fails the run if this time it differs in another way.
   */
  add(at: number, kind: string, input: string, options: unknown, sides: Record<string, string>) {
    const id = hash(`${input}\0${JSON.stringify(options ?? null)}`).slice(0, 12);
    const before = this.found.get(id);
    if (before) {
      if (before.kind !== kind || JSON.stringify(before.sides) !== JSON.stringify(sides))
        fail(
          `${JSON.stringify(input)} ${JSON.stringify(options)} differs in two ways, at ${before.at} and ${at}: ${before.kind} ${JSON.stringify(before.sides)}, then ${kind} ${JSON.stringify(sides)}`,
        );
      return;
    }
    this.inputs.set(id, input);
    const preview = JSON.stringify(input.slice(0, 40)) + (input.length > 40 ? "…" : "");
    this.found.set(id, {
      at,
      id,
      kind,
      ...(options === undefined ? {} : { options }),
      sides,
      input: preview,
    });
  }

  /** Checks what was found against the file, or with --update rewrites it. */
  finish(): void {
    const runs: Record<string, Run> = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, "utf8"))
      : {};
    const known = runs[this.run];
    const covered = Math.min(known?.iterations ?? 0, this.iterations);
    const expected = new Map(
      (known?.differences ?? []).filter((d) => d.at < covered).map((d) => [d.id, d]),
    );
    const line = (d: Difference) =>
      `${d.id} at ${d.at}, ${d.kind}${d.options === undefined ? "" : ` ${JSON.stringify(d.options)}`}: ${d.input}\n    ${Object.entries(
        d.sides,
      )
        .map(([side, outcome]) => `${side}: ${outcome}`)
        .join("\n    ")}`;
    const added: Difference[] = [];
    const changed: [Difference, Difference][] = [];
    for (const d of this.found.values()) {
      const before = expected.get(d.id);
      if (!before) added.push(d);
      else if (before.kind !== d.kind || JSON.stringify(before.sides) !== JSON.stringify(d.sides))
        changed.push([before, d]);
    }
    const gone = [...expected.values()].filter((d) => !this.found.has(d.id));
    const where = `${this.file.slice(this.file.indexOf("scripts/"))}, ${this.run}`;
    console.log(
      `known differences (${where}, ${known ? `${known.iterations} iterations recorded` : "none recorded"}): ${this.found.size} found, ${added.length} new, ${changed.length} changed, ${gone.length} gone`,
    );
    if (update && process.exitCode) {
      console.log(`not updating ${where}: the run failed`);
      return;
    }
    if (update) {
      runs[this.run] = {
        iterations: this.iterations,
        differences: [...this.found.values()].sort((a, b) => a.at - b.at),
      };
      writeFileSync(this.file, format(runs));
      console.log(`updated ${where}: review \`git diff scripts/baselines\` before committing`);
      return;
    }
    for (const d of added) console.log(`- new ${line(d)}${this.full(d.id)}`);
    for (const [before, d] of changed)
      console.log(`- changed ${line(d)}\n  was ${line(before)}${this.full(d.id)}`);
    for (const d of gone) console.log(`- gone ${line(d)}`);
    if (this.iterations > (known?.iterations ?? 0) && added.length)
      console.log(
        `- ${this.run} is recorded through ${known?.iterations ?? 0} iterations; differences past that are new`,
      );
    if (added.length || changed.length || gone.length)
      fail(
        `known differences in ${where}: ${added.length} new, ${changed.length} changed, ${gone.length} gone; if intended, rerun with --update and review the diff`,
      );
  }

  private full(id: string): string {
    return `\n    input: ${JSON.stringify(this.inputs.get(id))}`;
  }
}

// One record per line, records in iteration order, so a diff shows each
// difference added or removed as a line.
function format(runs: Record<string, Run>): string {
  const entries = Object.entries(runs).sort(([a], [b]) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  const body = entries.map(
    ([run, { iterations, differences }]) =>
      `  ${JSON.stringify(run)}: {\n    "iterations": ${iterations},\n    "differences": [${differences.length ? `\n${differences.map((d) => `      ${JSON.stringify(d)}`).join(",\n")}\n    ` : ""}]\n  }`,
  );
  return `{\n${body.join(",\n")}\n}\n`;
}
