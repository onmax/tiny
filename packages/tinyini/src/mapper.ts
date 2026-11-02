// TypeScript 7.1's content mapper for INI. TypeScript runs this file as a
// process of its own when a tsconfig lists tinyini in `contentMappers` and tsc
// runs with --runExternalCode, and asks it for each file with an extension the
// tsconfig registers. It answers with a module whose default export holds the
// file's value, so an import is typed as resolveJsonModule types a .json one.
// No entry imports it. The protocol:
// https://github.com/microsoft/typescript-go/blob/main/internal/contentmapper/hostimpl.go
import { parse } from "./parse.ts";

// The code after "tinyini" in what TypeScript prints.
const OPTION = 1;

// INI holds strings, booleans, null, arrays of them and sections, and the
// parser drops any `__proto__` key.
const print = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(print).join(", ")}]`;
  return `{ ${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}: ${print(item)}`)
    .join(", ")} }`;
};

/** The module for one file, which INI always parses to. `literal` types values as `as const`. */
const transform = (text: string, literal: boolean) =>
  `const data = ${print(parse(text))}${literal ? " as const" : ""};\nexport default data;\n`;

// Each project's `options`, by the handle TypeScript gives it.
const projects = new Map<string, { literal?: unknown }>();

function handle(method: string, params: any): unknown {
  switch (method) {
    case "initialize":
      return { protocolVersion: 1, positionEncoding: "utf-16", diagnosticSource: "tinyini" };
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
      return { text: transform(params.content, literal), extension: ".mts" };
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
