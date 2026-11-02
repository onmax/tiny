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

The root follows [json5](https://github.com/json5/json5)'s main branch, which holds json5 3 before its release, and adds a strict JSONC mode. Where json5 2 and JSON differ, it does what `JSON.parse` and `JSON.stringify` do:

- No `console.warn`. json5 2 warns about U+2028 and U+2029 in strings.
- The reviver walks own keys, as `JSON.parse`'s does, and a property it can't update stays as it is instead of throwing.
- Error positions count `\r`, `\r\n`, U+2028 and U+2029 as line breaks, and an error on a line break is reported on the line it ends.
- `{ bigint: true }` returns integers outside the safe range, decimal or hex, as BigInts. A number with a decimal point or an exponent stays a Number.
- `stringify` calls `toJSON5`, or else `toJSON`, on every value but `null` and `undefined`, as json5 does, where `JSON.stringify` calls `toJSON` only on objects and BigInts. It looks each up once and calls it before the replacer, in `JSON.stringify`'s order, and a BigInt left after them throws a `TypeError`. It reads replacer lists and arrays once, as `JSON.stringify` does.
- `stringify` takes only `'`, `"` or, for the default, `null` as `quote`, escapes lone surrogates, and writes keys with identifier characters above U+FFFF bare.

`{ jsonc: true }` accepts JSON with `//` and `/* */` comments and nothing more: no single quotes, unquoted keys, hex, `+`, `Infinity`, `NaN`, trailing commas, escapes JSON lacks, or whitespace other than JSON's. Line comments end at `\n` or `\r`, and block comments at `*/`.

Invalid input throws a `SyntaxError` with json5's message and its `lineNumber` and `columnNumber`, as in `JSON5: invalid character '@' at 2:5`.

Already on json5, strip-json-comments, jsonc-parser, comment-json or jju? Each has a drop-in subpath: see [Compatibility](/tinyjson5/compatibility/).

## `parse(text, reviver?, options?)`

Parses JSON5 and returns the value. `parse(text, options)` works too. The reviver is called as in json5 3, with the holder as `this` and each key and value, from the innermost out. Unlike `JSON.parse`'s, it gets no third `context` argument, and an array's length is read again at each element, so a reviver that changes an array's length changes which elements it visits.

| Option   | Default | What it does                                                                                                                                                                                                              |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bigint` | `false` | Return integers outside the safe range, decimal or hex, as BigInts. A number with a decimal point or an exponent stays a Number. Omitted or `null` is `false`; any other value that isn't a boolean throws a `TypeError`. |
| `jsonc`  | `false` | Accept only JSON with comments. Any truthy value turns it on.                                                                                                                                                             |

## `stringify(value, replacer?, space?)` and `stringify(value, options)`

Writes JSON5. The replacer is a function or a list of keys. `space` is a number of spaces, rounded down and at most 10, or a string, of which the first 10 characters are used; with no indent, as for 0, 0.5 or `""`, the output is on one line.

| Option     | Default | What it does                                                                                                                                                                         |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `replacer` | none    | A function that changes each value, or a list of the keys to keep.                                                                                                                   |
| `space`    | none    | Spaces per level, rounded down and at most 10, or a string, its first 10 characters. With an indent, each object or array written with at least one member ends in a trailing comma. |
| `quote`    | auto    | `'` or `"`. Omitted or `null`: `'`, or `"` when the string has more `'` than `"`. Anything else throws a `TypeError`.                                                                |

Keys that are identifiers are written bare. `NaN`, `Infinity` and `-Infinity` are written as such, `-0` as `0`. `toJSON5()` is used before `toJSON()`. A cycle throws `TypeError: Converting circular structure to JSON5`.
