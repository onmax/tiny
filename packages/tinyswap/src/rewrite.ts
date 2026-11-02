// Finds the module specifiers in a source file with oxc-parser, so a string
// that only looks like an import, in a comment, a template or JSX text, is
// never touched. Each specifier comes back as the range between its quotes:
// a rewrite replaces that and nothing else.
import { parseSync } from "oxc-parser";

export interface Specifier {
  value: string;
  /** Offsets of the text between the quotes. */
  start: number;
  end: number;
  line: number;
  /** `require` for a CommonJS load, `import` for a static import or re-export, `mock` for a test mock. */
  kind: "import" | "require" | "mock" | "other";
  /** The exports read from it by name, `default` for a default import. */
  names: string[];
}

export const SCRIPT = /\.(?:[cm]?[jt]s|[jt]sx)$/;
export const COMPONENT = /\.(?:vue|svelte|astro)$/;

type Lang = "js" | "jsx" | "ts" | "tsx" | "dts";

// The test runners' module mocks name a module the way an import does, so
// they move with it.
const MOCKS = new Map([
  ["vi", new Set(["mock", "doMock", "unmock", "doUnmock", "importActual", "importMock"])],
  ["jest", new Set(["mock", "doMock", "unmock", "dontMock", "requireActual", "requireMock"])],
]);

/**
 * The module specifiers in a file, or the parser's first error. For a
 * component, `markup` is the file outside its scripts, which isn't read.
 */
export function findSpecifiers(
  code: string,
  file: string,
): { specifiers: Specifier[]; markup?: string } | { error: string } {
  if (!COMPONENT.test(file)) return parseBlock(code, file, 0, langOf(file));
  const specifiers: Specifier[] = [];
  let markup = "";
  let last = 0;
  for (const block of scriptBlocks(code, file)) {
    const found = parseBlock(block.code, file, block.offset, block.lang);
    if ("error" in found) return found;
    specifiers.push(...found.specifiers);
    markup += code.slice(last, block.offset);
    last = block.offset + block.code.length;
  }
  for (const specifier of specifiers) specifier.line = lineOf(code, specifier.start);
  return { specifiers, markup: markup + code.slice(last) };
}

/** `code` with each specifier's text replaced by `replace`'s result, where it gives one. */
export function replaceSpecifiers(
  code: string,
  specifiers: Specifier[],
  replace: (specifier: Specifier) => string | undefined,
): string {
  let out = "";
  let last = 0;
  for (const specifier of [...specifiers].sort((a, b) => a.start - b.start)) {
    const next = replace(specifier);
    if (next === undefined) continue;
    out += code.slice(last, specifier.start) + next;
    last = specifier.end;
  }
  return out + code.slice(last);
}

function langOf(file: string): Lang {
  if (/\.d\.[cm]?ts$/.test(file)) return "dts";
  if (/\.[cm]?ts$/.test(file)) return "ts";
  if (file.endsWith(".tsx")) return "tsx";
  // JSX in .js files is common enough, and reads the same otherwise.
  return "jsx";
}

// The <script> blocks of a .vue, .svelte or .astro file, and an .astro file's
// frontmatter, which is TypeScript.
function scriptBlocks(code: string, file: string) {
  const blocks: { code: string; offset: number; lang: Lang }[] = [];
  // Scripts come after the frontmatter, so one written in a string there
  // isn't read as one.
  let start = 0;
  if (file.endsWith(".astro")) {
    const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(code);
    if (frontmatter?.[1] !== undefined) {
      blocks.push({
        code: frontmatter[1],
        offset: frontmatter[0].indexOf(frontmatter[1]),
        lang: "ts",
      });
      start = frontmatter[0].length;
    }
  }
  for (const match of code.slice(start).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const [whole, attributes = "", body = ""] = match;
    const lang = /\blang=["']?(tsx?|ts|jsx)\b/.exec(attributes)?.[1] as Lang | undefined;
    blocks.push({
      code: body,
      offset: start + match.index + whole.indexOf(">") + 1,
      lang: lang ?? (file.endsWith(".astro") ? "ts" : "jsx"),
    });
  }
  return blocks;
}

function parseBlock(
  code: string,
  file: string,
  offset: number,
  lang: Lang,
): { specifiers: Specifier[] } | { error: string } {
  const sourceType = file.endsWith(".cjs") || file.endsWith(".cts") ? "commonjs" : "unambiguous";
  let result = parseSync(file, code, { lang, sourceType });
  // A .js file can use `<` where JSX can't, as in an old-style type cast.
  if (result.errors.length && lang === "jsx")
    result = parseSync(file, code, { lang: "js", sourceType });
  const [error] = result.errors;
  if (error) {
    const at = error.labels[0]?.start;
    const where = at === undefined ? "" : ` at line ${lineOf(code, at)}`;
    return { error: `${error.message}${where}` };
  }
  const found = new Map<number, Specifier>();
  const add = (node: unknown, kind: Specifier["kind"], names: string[] = []) => {
    const literal = stringLiteral(node);
    if (!literal) return;
    const known = found.get(literal.start);
    if (known) known.names.push(...names);
    else
      found.set(literal.start, {
        value: literal.value,
        start: offset + literal.start + 1,
        end: offset + literal.end - 1,
        line: lineOf(code, literal.start),
        kind,
        names: [...names],
      });
  };
  walk(result.program, (node) => {
    switch (node.type) {
      case "ImportDeclaration": {
        const values = node.importKind === "type" ? [] : (node.specifiers as Node[]);
        const names = values.flatMap((specifier) =>
          specifier.importKind === "type"
            ? []
            : specifier.type === "ImportDefaultSpecifier"
              ? ["default"]
              : specifier.type === "ImportSpecifier"
                ? [nameOf(specifier.imported)]
                : [],
        );
        add(node.source, "import", names);
        break;
      }
      case "ExportNamedDeclaration": {
        const values = node.exportKind === "type" ? [] : (node.specifiers as Node[]);
        const names = values.flatMap((specifier) =>
          specifier.exportKind === "type" ? [] : [nameOf(specifier.local)],
        );
        add(node.source, "import", names);
        break;
      }
      case "ExportAllDeclaration":
      case "ImportExpression":
      case "TSImportType":
        add(node.source, "other");
        break;
      case "TSExternalModuleReference":
        add(node.expression, "require");
        break;
      case "CallExpression": {
        const callee = node.callee as Node;
        const argument = (node.arguments as unknown[])[0];
        if (isIdentifier(callee, "require")) add(argument, "require");
        else if (callee.type === "MemberExpression" && !callee.computed) {
          const object = callee.object as Node;
          const property = (callee.property as Node).name as string;
          if (isIdentifier(object, "require") && property === "resolve") add(argument, "other");
          else if (
            object.type === "MetaProperty" &&
            isIdentifier(object.meta as Node, "import") &&
            isIdentifier(object.property as Node, "meta") &&
            property === "resolve"
          )
            add(argument, "other");
          else if (object.type === "Identifier" && MOCKS.get(object.name as string)?.has(property))
            add(argument, "mock");
        }
        break;
      }
      // `const { load } = require("js-yaml")` and `require("js-yaml").load`
      // read names from it.
      case "VariableDeclarator": {
        const id = node.id as Node;
        const argument = requireArgument(node.init);
        if (argument && id.type === "ObjectPattern")
          add(
            argument,
            "require",
            (id.properties as Node[]).flatMap((property) =>
              property.type === "Property" && !property.computed ? [nameOf(property.key)] : [],
            ),
          );
        break;
      }
      case "MemberExpression": {
        const argument = requireArgument(node.object);
        if (argument && !node.computed) add(argument, "require", [nameOf(node.property)]);
      }
    }
  });
  return { specifiers: [...found.values()] };
}

// The argument of a `require()` call.
function requireArgument(node: unknown): unknown {
  const call = node as Node | null;
  if (call?.type !== "CallExpression" || !isIdentifier(call.callee as Node, "require"))
    return undefined;
  return (call.arguments as unknown[])[0];
}

// An identifier's name, or a string literal's value, as in `import { "a-b" as c }`.
const nameOf = (node: unknown) => {
  const { name, value } = node as Node;
  return (name ?? value) as string;
};

type Node = { type: string; [key: string]: unknown };

function walk(node: unknown, visit: (node: Node) => void) {
  if (Array.isArray(node)) for (const child of node) walk(child, visit);
  else if (node && typeof node === "object") {
    if (typeof (node as Node).type === "string") visit(node as Node);
    for (const value of Object.values(node))
      if (value && typeof value === "object") walk(value, visit);
  }
}

const isIdentifier = (node: Node, name: string) => node.type === "Identifier" && node.name === name;

// A string literal, or a template literal without substitutions.
function stringLiteral(node: unknown): { value: string; start: number; end: number } | undefined {
  if (!node || typeof node !== "object") return undefined;
  const { type, value, start, end, quasis, expressions } = node as Node;
  if (type === "Literal" && typeof value === "string")
    return { value, start: start as number, end: end as number };
  if (type === "TemplateLiteral" && !(expressions as unknown[]).length) {
    const cooked = ((quasis as Node[])[0]!.value as { cooked: string | null }).cooked;
    if (cooked !== null) return { value: cooked, start: start as number, end: end as number };
  }
  return undefined;
}

function lineOf(code: string, offset: number) {
  let line = 1;
  for (let i = code.indexOf("\n"); i !== -1 && i < offset; i = code.indexOf("\n", i + 1)) line++;
  return line;
}
