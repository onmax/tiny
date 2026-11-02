// TypeScript 7.1's content mapper for YAML. TypeScript runs this file as a
// process of its own when a tsconfig lists tinyaml in `contentMappers` and tsc
// runs with --runExternalCode, and asks it for each file with an extension the
// tsconfig registers. It answers with a module whose default export holds the
// file's value, so an import is typed as resolveJsonModule types a .json one.
// No entry imports it. The protocol:
// https://github.com/microsoft/typescript-go/blob/main/internal/contentmapper/hostimpl.go
import { findRefs } from "./core/refs.ts";
import { parseAll, YAMLError } from "./index.ts";

interface Diagnostic {
  messageText: string;
  start: number;
  length: number;
  code: number;
}

// The codes after "tinyaml" in what TypeScript prints.
const SYNTAX = 1;
const RECURSIVE = 2;
const OPTION = 3;

// What a file that doesn't parse exports, so the parse error is the only one.
const ANY = "declare const data: any;\nexport default data;\n";

// A key in quotes, but `__proto__` in brackets, where it names a property
// rather than setting the prototype.
const property = (key: string) => (key === "__proto__" ? `["${key}"]` : JSON.stringify(key));

/**
 * The module for one file: the documents in a tuple when there are several,
 * and each object aliases reach more than once in a const of its own, so an
 * alias costs a name rather than a copy. `literal` types values as `as const`.
 */
function transform(text: string, literal: boolean): { text: string; diagnostics?: Diagnostic[] } {
  let docs: unknown[];
  try {
    docs = parseAll(text);
  } catch (error) {
    if (!(error instanceof YAMLError)) throw error;
    let start = 0;
    for (let line = 1; line < error.line; line++) start = text.indexOf("\n", start) + 1;
    start = Math.min(start + error.column - 1, text.length);
    // TypeScript prints the position, so the message leaves it out.
    const messageText = error.message.replace(/ \(\d+:\d+\)$/, "");
    const length = start < text.length ? 1 : 0;
    return { text: ANY, diagnostics: [{ messageText, start, length, code: SYNTAX }] };
  }
  // undefined and non-finite numbers already have their only possible type;
  // their expressions cannot take a const assertion.
  const end = (value: unknown) =>
    literal && value !== undefined && (typeof value !== "number" || Number.isFinite(value))
      ? " as const;\n"
      : ";\n";
  const refs = findRefs(docs);
  const out: string[] = [];
  const done = new Set<object>();
  const open = new Set<object>();
  const print = (value: unknown): string => {
    if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
    const name = refs.get(value);
    if (name && done.has(value)) return name;
    if (open.has(value)) throw new Error("a recursive alias can't be typed");
    open.add(value);
    const body = Array.isArray(value)
      ? `[${value.map(print).join(", ")}]`
      : `{ ${Object.entries(value)
          .map(([key, item]) => `${property(key)}: ${print(item)}`)
          .join(", ")} }`;
    open.delete(value);
    if (!name) return body;
    done.add(value);
    out.push(`const ${name} = ${body}${end(value)}`);
    return name;
  };
  try {
    if (docs.length < 2) out.push(`const data = ${print(docs[0])}${end(docs[0])}`);
    else {
      for (const [i, doc] of docs.entries()) out.push(`const doc_${i} = ${print(doc)}${end(doc)}`);
      out.push(`const data = [${docs.map((_, i) => `doc_${i}`).join(", ")}] as const;\n`);
    }
  } catch (error) {
    const messageText = (error as Error).message;
    return { text: ANY, diagnostics: [{ messageText, start: 0, length: 0, code: RECURSIVE }] };
  }
  return { text: `${out.join("")}export default data;\n` };
}

// Each project's `options`, by the handle TypeScript gives it.
const projects = new Map<string, { literal?: unknown }>();

function handle(method: string, params: any): unknown {
  switch (method) {
    case "initialize":
      return { protocolVersion: 1, positionEncoding: "utf-16", diagnosticSource: "tinyaml" };
    case "openProject": {
      const options = params.options ?? {};
      projects.set(params.projectHandle, options);
      if (options.literal === undefined || typeof options.literal === "boolean") return {};
      const messageText = "literal must be true or false";
      return { optionDiagnostics: [{ path: ["literal"], messageText, code: OPTION }] };
    }
    case "closeProject":
      projects.delete(params.projectHandle);
      return null;
    case "transform": {
      const literal = projects.get(params.projectHandle)?.literal === true;
      return { ...transform(params.content, literal), extension: ".mts" };
    }
  }
  throw new Error(`unknown method ${method}`);
}

// JSON-RPC over stdin and stdout, each message after a Content-Length header,
// as in the Language Server Protocol.
const send = (message: object) => {
  const body = JSON.stringify({ jsonrpc: "2.0", ...message });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
};
let input = Buffer.alloc(0);
process.stdin.on("data", (chunk: Buffer) => {
  input = Buffer.concat([input, chunk]);
  for (let end; (end = input.indexOf("\r\n\r\n")) >= 0;) {
    const length = Number(/content-length: *(\d+)/i.exec(input.toString("latin1", 0, end))?.[1]);
    if (input.length < end + 4 + length) return;
    const { id, method, params } = JSON.parse(input.toString("utf8", end + 4, end + 4 + length));
    input = input.subarray(end + 4 + length);
    // Notifications, which have no id, need no answer.
    if (id === undefined) continue;
    try {
      send({ id, result: handle(method, params) });
    } catch (error) {
      send({ id, error: { code: -32603, message: String(error) } });
    }
  }
});
