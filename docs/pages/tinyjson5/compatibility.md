---
title: Compatibility with each original
label: Compatibility
description: The subpaths that replace json5 2 and 1, strip-json-comments, jsonc-parser, comment-json and jju, how each was checked, and every place it still differs.
---

Each subpath exports the functions, options and types of the library it replaces, apart from the gaps listed below, so switching is a change to the import line. The last column is that library's own test suite, copied unchanged into `test/` and run with tinyjson5 in its place.

| Library                   | Change the import to                 | Size, gzip      | Its own tests on tinyjson5 |
| ------------------------- | ------------------------------------ | --------------- | -------------------------- |
| json5 2.2.3               | `"tinyjson5/json5"`                  | 7.6 → 3.2 KiB   | 160 of 160                 |
| json5 1.0.2               | `"tinyjson5/json5-v1"`               | 8.4 → 3.3 KiB   | 144 of 144                 |
| strip-json-comments 3.1.1 | `"tinyjson5/strip-json-comments"`    | 0.8 → 0.5 KiB   | 10 of 10                   |
| strip-json-comments 2.0.1 | `"tinyjson5/strip-json-comments-v2"` | 0.7 → 0.5 KiB   | 9 of 9                     |
| strip-json-comments 5.0.3 | `"tinyjson5/strip-json-comments-v5"` | 654 → 646 B     | 13 of 13                   |
| jsonc-parser 3.3.1        | `"tinyjson5/jsonc-parser"`           | 6.6 → 5.7 KiB   | 83 of 83                   |
| comment-json 4.6.2        | `"tinyjson5/comment-json"`           | 35.7 → 18.4 KiB | 384 of 384                 |
| jju 1.4.0                 | `"tinyjson5/jju"`                    | 9.8 → 9.7 KiB   | 421 of 423                 |

The 2 jju tests that fail here fail on jju itself under today's Node, because they compare it with `eval`. json5 2.2.3's tests include json5's errors tests. tinyjson5's root also runs json5's main-branch tests, and 197 of 198 pass. The one that fails needs an identifier character from Unicode 18, which Node 24 doesn't know yet.

```ts
// before
import { parse, modify, applyEdits } from "jsonc-parser";
// after
import { parse, modify, applyEdits } from "tinyjson5/jsonc-parser";
```

Every subpath is also checked by differential fuzzing. The fuzzer edits the json5-tests corpus, each library's own test inputs and generated documents at random, and runs each input through both libraries with options picked from all the subpath takes. The sections below give the counts and list each known difference.

All subpaths are ES modules. None has a CommonJS build, a CLI, or a `require` hook for `.json5` files. Node 22.12 and later load them with `require()` too, which returns the module's exports, so a default export, such as strip-json-comments' function, is under `.default`.

## Bugs tinyjson5 doesn't copy

| Library                                 | Bug                                                                                                                                                                                                                     | tinyjson5                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| json5 1.0.1 and earlier, 2.0.0 to 2.2.1 | A `__proto__` key in the text replaces the parsed object's prototype, so its fields show through on the result (CVE-2022-46175).                                                                                        | Every entry keeps `__proto__` as an own key, as json5 1.0.2 and 2.2.2 do.                                   |
| json5 1.0.2                             | A hex number at the end of the input makes it append the string `"undefined"` until it reaches the longest string there can be: `parse("0x1")` takes about 9 seconds and hundreds of megabytes before its `RangeError`. | tinyjson5/json5-v1 throws the same `RangeError` at once.                                                    |
| json5 2.2.3 and 1.0.2                   | A `parse` called from a `console.warn` handler, while json5 warns about U+2028 or U+2029 in a string, makes the outer `parse` return the inner one's value.                                                             | The json5 subpaths throw an end-of-input error instead of returning the wrong value. The root doesn't warn. |
| json5 2.2.3 and 1.0.2                   | The reviver walks inherited enumerable keys, so with one on `Object.prototype` every revived object gets a copy of it as its own property.                                                                              | The root walks own keys, as `JSON.parse` does.                                                              |
| json5 2.2.3 and 1.0.2                   | An error after a `\r`, U+2028 or U+2029 line break is reported on the line before: `1\r@` gives 1:3 where it's 2:1.                                                                                                     | The root counts those line breaks.                                                                          |
| json5 2.2.3 and 1.0.2                   | `stringify` writes a lone surrogate as it is, which isn't valid UTF-8 once encoded.                                                                                                                                     | The root escapes it, as `JSON.stringify` does.                                                              |
| json5 2.2.3 and 1.0.2                   | `stringify` drops BigInts without a word: `{a: 1n, b: 2}` gives `{b:2}`.                                                                                                                                                | The root throws a `TypeError`, as `JSON.stringify` does.                                                    |

The json5 subpaths are drop-ins, so they keep the last four as json5 2 and 1 have them. The root follows json5 3 and fixes them. The other subpaths keep their originals' behavior, bugs included.

## json5 2.2.3 and 1.0.2

- Identifier characters come from the JavaScript engine's own Unicode tables (`\p{ID_Start}`, `\p{ID_Continue}`), not the ones json5 ships (Unicode 10 in 2.2.3, older in 1.0.2). On Node 24 (Unicode 17), the engine's tables have 20,588 more characters that can start an unquoted key than json5 2.2.3's, and 21,146 more that can continue one. U+0560 is one of them. No character json5 accepts is rejected. U+2E2F, which json5's tables count as a letter, is special-cased to keep it that way. `pnpm unicode` prints the full list.
- json5 1.0.2 reads the end of input as the string `"undefined"`, whose `d`, `e` and `f` are hex digits. A hex number that ends the input makes it append `"undefined"` until the string is too long, which takes seconds and hundreds of megabytes. tinyjson5/json5-v1 throws the same `RangeError: Invalid string length` at once.
- json5 1.0.2 is compiled by Babel, and its `for...of` loops go through iterators. A replacer list is iterated as Babel does, but strings and key lists are not, so a patched `String.prototype[Symbol.iterator]`, or an `Array.prototype[Symbol.iterator]` whose `next` or `return` changes, is used differently.
- A `parse` called from inside `console.warn` while json5 warns about U+2028 returns the inner result in json5, whose shared state it overwrites. tinyjson5 throws an end-of-input error there.
- `stringify` and the reviver recurse in both, and run out of stack at slightly different depths.
- 1,000,500 inputs each (500 seeds and a million edits of them) give the same value or the same error, message and position as json5 2.2.3 (739,687 errors) and json5 1.0.2 (757,833 errors, 4,543 of them that `RangeError`), and the same warnings.
- 14,000 random values through every space, quote and replacer make 1,037,400 `stringify` calls each. The output is byte-identical, or the same `TypeError` where json5 throws. That happens in 14,025 calls, for cycles and for a `"__proto__"` key that reaches `Date.prototype.toJSON`. Every round trip reads back.

## strip-json-comments 3, 2 and 5

- Given an argument that isn't a string, null or undefined, strip-json-comments 2 runs its loop on the object itself, through `length`, its indexes, `slice` and `substr`. tinyjson5/strip-json-comments-v2 reads `length`, throws `TypeError: str.substr is not a function` if there's no `substr`, and otherwise strips `String(argument)`. Matching 2 here would make the subpath bigger than strip-json-comments 2 itself.
- 1,000,400 inputs each (400 seeds and a million edits of them), with every option set, make 3,001,221 calls to 3, 4,001,628 to 2 and 5,002,035 to 5. All give the same output or the same error.

## jsonc-parser

- Its enums are declared as `declare enum`, not `declare const enum`. Code reads `SyntaxKind.StringLiteral` from the exported object instead of inlining 10, which also works under `isolatedModules` and `verbatimModuleSyntax`.
- `visit` passes one path-supplier function to all of a visit's callbacks, where jsonc-parser makes a new one for each. Each returns the path at the time it's called, as there.
- Token values are cut from the text with `substring`, when asked for, where jsonc-parser builds trivia with `String.fromCharCode` and cuts the rest as it scans. A program that replaces `String.prototype.substring` or `String.fromCharCode`, also between a `scan()` and its `getTokenValue()`, sees other calls and values; `String.prototype.charCodeAt` is called as jsonc-parser calls it.
- No deep imports such as `jsonc-parser/lib/esm/impl/format`. Its `string-intern` test, which tests caches inside its formatter, isn't run.
- 1,000,922 inputs (922 seeds and a million edits of them) make 23,021,226 calls over the whole API: the scanner in both trivia modes and after `setPosition`, `parse` and `parseTree` with each option set, `visit` with suppressed callbacks, `getLocation`, `findNodeAtOffset`, `findNodeAtLocation`, `getNodePath`, `getNodeValue`, `stripComments`, `format` with random ranges and options and `modify` with random paths, values and options, both through `applyEdits`. All give the same result or throw the same error.

## comment-json

- `stringify` reads each object's comments once per call. Code that runs while the value is written and adds or changes comments, such as a getter, a `toJSON`, or the `toString` of a comment's value, isn't seen, where comment-json reads them again. An object with a getter for a comment is read as comment-json reads it, and a proxy sees other traps. This holds only without a replacer, and only while `Symbol.for` and the prototypes of objects, arrays and `CommentArray` are as they were. Otherwise comments are read as comment-json reads them.
- `tokenize` builds esprima's tokens itself for JSON with comments, and hands any other input to esprima's own tokenizer, which comes along unchanged.
- Both faster paths, the comment read and the tokenizer, run only while the built-ins they rely on are the engine's own, and otherwise do what comment-json and esprima do. They check each built-in's name and source, read from its descriptor without running a getter, and what it does on a known input. A program that replaces `globalThis`, `Object`, `Function`, `Reflect`, `Object.getOwnPropertyDescriptor`, `Reflect.apply` or `Function.prototype.toString` before tinyjson5 loads can fool that check, which has to read and call them before it can check anything.
- No CommonJS build and no deep imports. `require("tinyjson5/comment-json")` works on Node 22.12 and later.
- 1,000,509 inputs (509 seeds and a million edits of them) make 8,004,072 calls: `parse` with and without comments and with a reviver, compared with every comment symbol and token; `tokenize`; `stringify` with a space and a replacer picked at random; `assign`, `moveComments` and `removeComments`. All give the same result or throw the same error, with esprima's and comment-json's error fields.

## jju

- jju's `utils` are left out. They are its `require` hook for `.json5` files, its `JSON.parse` patch and its middleware, all Node-only.
- Off Node, an assertion `update` trips throws an `AssertionError`-named error with Node's `code`, `actual`, `expected` and `operator`, but a shorter message and no `generatedMessage` or `diff`. On Node it's Node's own `AssertionError`, as in jju.
- 1,000,648 inputs (648 seeds and a million edits of them) make 6,003,888 calls: `parse` with a mode and options picked at random, `tokenize`, `analyze`, `stringify` with random options, and `update`, with the same result or the same error, `row` and `column` included.

jju, comment-json and array-timsort are written for sloppy mode, and their ports run as ES modules, which are strict. Writes that would fail silently there go through `Reflect.set` and `Reflect.deleteProperty` here, so frozen options, objects and arrays behave the same. jju's go through one sloppy-mode function made with `Function` instead, which is faster, and through `Reflect` where a Content-Security-Policy or `--disallow-code-generation-from-strings` blocks it.
