---
title: Get started
description: Install tinyini and read and write INI with its own API, or switch from ini or @one-ini/wasm with one import.
---

```sh
pnpm add tinyini
```

npm holds only a 0.0.0 placeholder under this name until the first release. Until then, clone [the repository](https://github.com/onmax/tiny) and run `pnpm install` and `pnpm build` to get the package in `dist/`.

```ts
import { parse, stringify } from "tinyini";

parse("; comment\nname = app\ntags[] = a\ntags[] = b\n[server.http]\nport = 8080\n");
// { name: "app", tags: ["a", "b"], server: { http: { port: "8080" } } }
stringify({ name: "app", debug: "true", server: { port: 8080 } }, { whitespace: true });
// 'name = app\ndebug = "true"\n\n[server]\nport = 8080\n'
```

`parse(text)` returns an object with a null prototype, as are its sections:

- A line that starts with `;` or `#` is a comment. In a value, an unescaped `;` or `#` starts one too; write `\;`, `\#` and `\\` for the characters.
- `[name]` starts a section. Dots nest it, `[a.b]` inside `a`, unless a backslash escapes them, and a name in double quotes is read as a JSON string. A section replaces a value of the same name.
- `key = value` sets a key, and a line with no `=` sets it to `true`. The key is the text before the first `=`, or a JSON string in double quotes. `true`, `false` and `null` become values, everything else stays a string.
- A value in double quotes is read as a JSON string, and one in single quotes as the text between them. Either way it stays a string, so `"true"` is the string `true`.
- `key[] = value` adds to an array. A `key[]` after `key = value` keeps that value as the first item, and a plain `key` after them replaces the array.
- `__proto__` keys and sections are dropped.

`stringify(value, options?)` writes the values of each object first, and then each object in it as a section, in the layout ini uses. It quotes keys, values and section names that `parse` would read differently, so `parse(stringify(x))` gives back `x`, with numbers and BigInts as strings. `toJSON` is called, so a Date becomes an ISO string. Functions, symbols and `undefined` are left out of objects and written as `null` in arrays, an empty array is left out, since INI has no way to write one, and an object in an array throws.

| Option       | Default | What it does                                                                 |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| `whitespace` | `false` | Put a space on each side of the `=`.                                         |
| `align`      | `false` | Pad the keys of each section so the `=` signs line up. Implies `whitespace`. |
| `sort`       | `false` | Sort the keys and sections on each level.                                    |
| `newline`    | `false` | Put a blank line after each section header.                                  |
| `eol`        | `"\n"`  | The line ending.                                                             |

The rules are ini's, minus what ini keeps only for compatibility. [`scripts/root-spec.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyini/scripts/root-spec.ts) states them as plainly as it can, and the root is fuzzed against it. Coming from ini 7, this is what changes:

- `parse` takes no options, and neither function writes to the options you pass. `stringify` has no `section` or `platform` option and no string second argument; `eol` sets the line ending.
- Quoted values stay strings. ini reads `"true"` as `true` and `'1'` as the number 1.
- Keys are taken as written, so `a;b = 1` is the key `a;b`, where ini cuts it to `a`. A quoted key must be a JSON string; ini reads any JSON there and throws on `'null' = x`.
- Sections nest when they are read, so keys keep the order they first appear in, and `\.` is a dot in every part of a name. A section replaces a value of the same name, where ini throws or drops the section's keys, and `[a.b]` after `a = null` doesn't throw.
- A plain key after `key[]` lines replaces the array, where ini adds to it. There is no `bracketedArray: false`, so a repeated key keeps its last value.
- `stringify` quotes values `parse` would change, such as `"true"`, `"a;b"` or `"a\\b"`, as JSON strings, where ini writes `true`, `a\;b` and `a\b`. It writes an empty object as an empty section, leaves out `undefined`, and throws on an object in an array, where ini leaves out the section, writes `undefined`, and writes the object as JSON.

Already on ini or @one-ini/wasm? Each has a drop-in subpath: see [Compatibility](/tinyini/compatibility/).

## Typed imports

![VS Code with config.ini beside app.ts, which imports it: hovering config shows the type TypeScript gives the INI file, and a misspelled key is an error](/demos/tinyini-typed-imports.png)

tinyini is also a TypeScript 7.1 [content mapper](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/). Register it in `tsconfig.json`, and TypeScript types an import of an INI file as it types a `.json` one under `resolveJsonModule`:

```jsonc
{
  "contentMappers": [{ "package": "tinyini", "extensions": [".ini"] }]
}
```

```ts
import config from "./config.ini"; // { name: string; server: { port: string } }
```

Content mappers run code, so tsc needs `--runExternalCode`. `"options": { "literal": true }` types values as `as const` would. TypeScript checks every file with a registered extension that the project includes, so use a narrower one, such as `.config.ini`, if only some of them are config. The mapper only gives the import its type; your bundler or runtime still has to load the file. TypeScript runs `dist/mapper.mjs` as a process of its own, and no entry imports it, so nothing you bundle gets bigger.
