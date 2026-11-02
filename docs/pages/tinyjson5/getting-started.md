---
title: Get started
description: Install tinyjson5 and read and write JSON5, or JSON with comments, with its own API.
---

```sh
pnpm add tinyjson5
```

npm holds only a 0.0.0 placeholder under this name until the first release. Until then, clone [the repository](https://github.com/onmax/tiny) and run `pnpm install` and `pnpm build` to get the package in `dist/`.

```ts
import JSON5, { parse, stringify } from "tinyjson5";

parse("{name: 'app', tags: ['a', 'b',], /* comment */ size: 0x10}");
// { name: "app", tags: ["a", "b"], size: 16 }
parse('// tsconfig\n{"strict": true}', { jsonc: true }); // { strict: true }
parse("9007199254740993", { bigint: true }); // 9007199254740993n
stringify({ name: "app", "a-b": [1, NaN] }); // "{name:'app','a-b':[1,NaN]}"
stringify({ a: 1 }, null, 2); // "{\n  a: 1,\n}"
JSON5.parse("[1, 2]"); // [1, 2]
```

The root follows [json5](https://github.com/json5/json5)'s main branch, which holds json5 3 before its release, and adds a strict JSONC mode. It differs from json5 2 in these ways, most of them toward what `JSON.parse` and `JSON.stringify` do:

- No `console.warn`. json5 2 warns about U+2028 and U+2029 in strings.
- The reviver walks own keys, as `JSON.parse`'s does, and a property it can't update stays as it is instead of throwing.
- Error positions count `\r`, `\r\n`, U+2028 and U+2029 as line breaks, and an error on a line break is reported on the line it ends.
- `{ bigint: true }` returns integers outside the safe range, decimal or hex, as BigInts. A number with a decimal point or an exponent stays a Number.
- `stringify` calls `toJSON5`, or else `toJSON`, on every value but `null` and `undefined`, as json5 does, where `JSON.stringify` calls `toJSON` only on objects and BigInts. It looks each up once and calls it before the replacer, in `JSON.stringify`'s order, and a BigInt left after them throws a `TypeError`. It reads replacer lists and arrays once, as `JSON.stringify` does.
- `stringify` takes only `'`, `"` or, for the default, `null` as `quote`, escapes lone surrogates, and writes keys with identifier characters above U+FFFF bare.

`{ jsonc: true }` accepts JSON with `//` and `/* */` comments. It rejects single quotes, unquoted keys, hex, `+`, `Infinity`, `NaN`, trailing commas, escapes JSON lacks, and whitespace other than JSON's. Line comments end at `\n` or `\r`, and block comments at `*/`.

Invalid input throws a `SyntaxError` with json5's message and its `lineNumber` and `columnNumber`, as in `JSON5: invalid character '@' at 2:5`.

json5, strip-json-comments, jsonc-parser, comment-json and jju each have a drop-in subpath, listed in [Compatibility](/tinyjson5/compatibility/).

## `parse(text, reviver?, options?)`

Parses JSON5 and returns the value. `parse(text, options)` works too. The reviver is called as in json5 3, with the holder as `this` and each key and value, from the innermost out. Unlike `JSON.parse`'s, it gets no third `context` argument, and an array's length is read again at each element, so a reviver that changes an array's length changes which elements it visits.

| Option   | Default | What it does                                                                                                                                                                                                              |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bigint` | `false` | Return integers outside the safe range, decimal or hex, as BigInts. A number with a decimal point or an exponent stays a Number. Omitted or `null` is `false`; any other value that isn't a boolean throws a `TypeError`. |
| `jsonc`  | `false` | Accept only JSON with comments. Any truthy value turns it on.                                                                                                                                                             |

## `stringify(value, replacer?, space?)` and `stringify(value, options)`

Writes JSON5. The replacer is a function or a list of keys. `space` is a number of spaces, rounded down and at most 10, or a string, of which the first 10 characters are used. With no indent, as for 0, 0.5 or `""`, the output is on one line.

| Option     | Default | What it does                                                                                                                                                                         |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `replacer` | none    | A function that changes each value, or a list of the keys to keep.                                                                                                                   |
| `space`    | none    | Spaces per level, rounded down and at most 10, or a string, its first 10 characters. With an indent, each object or array written with at least one member ends in a trailing comma. |
| `quote`    | auto    | `'` or `"`. Omitted or `null` picks `'`, or `"` when the string has more `'` than `"`. Anything else throws a `TypeError`.                                                           |

Keys that are identifiers are written bare. `NaN`, `Infinity` and `-Infinity` are written as such, `-0` as `0`. `toJSON5()` is used before `toJSON()`. A cycle throws `TypeError: Converting circular structure to JSON5`.

## Typed imports

![VS Code with config.json5 beside app.ts, which imports it: hovering config shows the type TypeScript gives the JSON5 file, and a misspelled key is an error](/demos/tinyjson5-typed-imports.png)

tinyjson5 is also a TypeScript 7.1 [content mapper](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/). Register it in `tsconfig.json`, and TypeScript types an import of a JSON5 file as it types a `.json` one under `resolveJsonModule`:

```jsonc
{
  "contentMappers": [{ "package": "tinyjson5", "extensions": [".json5", ".jsonc"] }]
}
```

```ts
import config from "./config.json5"; // { name: string; port: number }
```

Content mappers run code, so tsc needs `--runExternalCode`. `"options": { "literal": true }` types values as `as const` would. Both extensions are read as JSON5, which accepts all of JSON with comments, and a syntax error is reported at its line and column. TypeScript checks every file with a registered extension that the project includes, so use a narrower one, such as `.config.json5`, if only some of them are config. The mapper only gives the import its type; your bundler or runtime still has to load the file. TypeScript runs `dist/mapper.mjs` as a process of its own, and no entry imports it, so nothing you bundle gets bigger.
