---
title: Compatibility with each original
label: Compatibility
description: The subpaths that replace ini 7, 2 and 1.3.8 and @one-ini/wasm 0.2 and 0.1, how each was checked, and every place it still differs.
---

Each subpath exports the functions of the library it replaces, so switching is a change to the import line. The last column is that library's own test suite, run with tinyini in its place.

| Library                   | Change the import to     | Size, gzip      | Its own tests on tinyini                    |
| ------------------------- | ------------------------ | --------------- | ------------------------------------------- |
| ini 4.1.3 to 7.0.0        | `"tinyini/ini"`          | 1.64 → 1.53 KiB | 40 of 40 pass                               |
| ini 2.0.0, 3.x and 4.0.0  | `"tinyini/ini-v2"`       | 1.40 → 1.36 KiB | 60 of 60 pass (2.0.0's and 4.0.0's)         |
| ini 1.3.8                 | `"tinyini/ini-v1"`       | 1.40 → 1.37 KiB | 30 of 30 pass                               |
| @one-ini/wasm 0.2.x       | `"tinyini/one-ini"`      | 36.0 → 1.68 KiB | editorconfig-core-test: 202 of 203, as WASM |
| @one-ini/wasm 0.1.1–0.1.3 | `"tinyini/one-ini-v0.1"` | 32.3 → 1.68 KiB | editorconfig-core-test: 201 of 203, as WASM |

```ts
// before
import ini from "ini";
import { parse_to_uint32array } from "@one-ini/wasm";
// after
import ini from "tinyini/ini";
import { parse_to_uint32array } from "tinyini/one-ini";
```

Which ini you have decides the subpath, and `npm ls ini` shows it. `rc` pins 1.3.x, which is why 1.3.8 still has the most downloads. [`scripts/versions.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyini/scripts/versions.ts) fuzzes 15 published ini versions, every one from 1.3.7 on plus 1.3.4 and 1.3.5, each against the next, to find where they behave differently: 1.3.8 differs from 2.0.0 on every input (plain objects against null-prototype ones), 2.0.0 to 4.0.0 behave the same, 4.1.0 added options and changed how whitespace-only lines and section headers are read, and 4.1.3 to 7.0.0 behave the same. @one-ini/wasm 0.2.0 reads `key =` as an empty value, where 0.1.x stops parsing there; `editorconfig` 1 uses 0.1.1, and `editorconfig` 3 uses 0.2.1.

## Bugs tinyini doesn't copy

| Library               | Bug                                                                                                                                                                            | tinyini                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| ini 1.3.5 and earlier | A `[__proto__]` section writes its keys onto `Object.prototype`, so every object in the program gets them (CVE-2020-7788).                                                     | The root and the ini subpaths drop `__proto__` sections and keys. |
| ini 1.3.8             | 2.89 KiB                                                                                                                                                                       | 1.40 KiB                                                          |
| ini 4.1.0 to 4.1.2    | With `bracketedArray: false`, a key that repeats loses its last two characters.                                                                                                | tinyini/ini keeps the key, as ini 4.1.3 does.                     |
| ini 4.1.0             | Throws where there is no `process`, as in a browser.                                                                                                                           | tinyini/ini checks that `process` exists, as ini 4.1.1 does.      |
| @one-ini/wasm         | The WASM memory grows on every call and is never freed. At 4 GiB every call throws `RuntimeError: unreachable`; with 0.2.1 and 0.2.2 that takes 65,506 calls on a 6.4 KB file. | Keeps nothing between calls.                                      |

The subpaths share one core, built once per library; the root has its own smaller parser and stringifier. The sections below list each known difference from the original.

## ini 7: what's different

- Strict mode. ini is CommonJS in sloppy mode, where a write to a primitive or a frozen object does nothing. tinyini is an ES module, so it checks for those cases and does nothing too: `parse("a=1\n[a]\nb=2")` returns `{ a: "1" }` in both. The copy of ini that confbox bundles is an ES module and throws `Cannot create property 'b' on string '1'` there.
- Replaced built-ins. tinyini reads options and values in ini's order, so getters and proxies see the same reads, but it doesn't call `JSON.parse` or string methods everywhere ini does, so a program that replaces one of them, for instance from inside an option's getter, can see a different result.
- Arguments that are neither strings nor `String` objects but have their own `split` or `trim` method, passed to `parse` or `unsafe`, can give a different result.
- Stack depth. Both write nested objects recursively and run out of stack at different depths: on Node 26, ini writes 5,680 nested objects and tinyini/ini 5,664.
- ini 4.1.0 to 4.1.2: with `bracketedArray: false`, they cut the last two characters off a key that repeats, a bug 4.1.3 fixed. tinyini/ini doesn't. ini 4.1.0 also throws where there is no `process`, as in a browser.
- Packaging. ESM only, with named exports next to the default. The types are the signatures of `@types/ini` 4.1.1, plus exported `DecodeOptions` and `EncodeOptions`.

## ini 2: what's different

- Windows. ini 2.0.0 to 4.0.0 pick the line ending from `process.platform` when they load; tinyini/ini-v2 reads it each time it writes.
- Stack depth: on Node 26, ini 2.0.0 writes 5,948 nested objects and tinyini/ini-v2 5,647.
- Strict mode, replaced built-ins, arguments with their own `split` or `trim`, and packaging, as for ini 7. The types take only `section` and `whitespace`, the options ini 2 reads.

## ini 1.3.8: what's different

- A section named after a property every object inherits, such as `[constructor]`, `[toString]` or `[hasOwnProperty]`. ini 1.3.8 looks the name up on its plain result object, finds the built-in function, and writes the section's keys onto it, so `[constructor]` followed by `keys = 1` replaces `Object.keys` for the whole program. tinyini/ini-v1 starts a new object for the section instead, as later versions do. The fuzzer checks those inputs against ini 1.3.8 with that one line changed.
- Windows, strict mode, replaced built-ins, arguments with their own `split` or `trim`, and packaging, as for ini 2. Stack depth: ini 1.3.8 writes 2,303 nested objects and tinyini/ini-v1 4,808.
- Versions before 1.3.8 differ from it: 1.3.5 and earlier write a `[__proto__]` section's keys to `Object.prototype`, and 1.3.7 returns null-prototype objects.

## @one-ini/wasm: what's different

- Memory. The WASM module's memory grows on every call, by about 48 KiB for a 1 KiB file in 0.1.1, and once it reaches 4 GiB every call throws `RuntimeError: unreachable`, for good. With 0.2.1 and 0.2.2 that takes 65,506 calls to `parse_to_uint32array` on a 6.4 KB file, and about 258,000 on an 800-byte one ([reproduction](https://github.com/onmax/repros/tree/repro/one-ini-wasm-memory/one-ini-wasm-memory)). tinyini keeps nothing between calls.
- Arguments of the wrong type. tinyini copies an argument in as wasm-bindgen's glue does, so a string, a `String` object, a typed array, a `Buffer` or an array gives the same result or error, and so does an array-like whose `length` is negative. An argument that doesn't act like one can differ: one whose `length` grows from one read to the next, even on a real `Uint8Array`, a typed array whose own `length` hides more bytes than the WASM module's memory has room for (it throws, tinyini doesn't), a `length` that is fractional or from 2³¹ up to 4 GiB (0.1.1 allocates that much memory, where tinyini throws `RuntimeError: unreachable` as 0.2.1 does), and a `charCodeAt` that returns something other than a UTF-16 code unit, such as a negative number.
- Exports. `parse_to_json`, `parse_to_uint32array`, `version` and `TokenTypes`, as named exports and on the default export. 0.1.1 also exports wasm-bindgen's internal functions and `__wasm`, which tinyini leaves out.
- `version()` and the AST's `version` say 0.2.1 or 0.1.1, the versions `editorconfig` 3 and 1 pin. 0.2.0, 0.2.2, 0.1.2 and 0.1.3 say their own version and otherwise give the same results on 20,083 fuzzed inputs each (`THEIRS=<path> node scripts/one-ini-fuzz.ts 20000 1 one-ini`, or `one-ini-v0.1` for 0.1.x). 0.1.0 reads comments differently, trimming their text, and tinyini doesn't follow it.

## How it's checked

Each subpath is checked against the library it replaces, which is installed next to it as a development dependency:

- The original's own tests, copied unchanged into [`test/suites`](https://github.com/onmax/tiny/tree/main/packages/tinyini/test/suites) and run with tinyini in its place: ini 7.0.0's, 2.0.0's, 4.0.0's and 1.3.8's tap tests, with their snapshots; one-ini's Rust tests (`integration_test.rs` and `node.rs`), turned into JavaScript by [`scripts/one-ini-tests.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyini/scripts/one-ini-tests.ts), 42 of 42 with each WASM version and each tinyini entry; and [editorconfig-core-test](https://github.com/editorconfig/editorconfig-core-test) through the `editorconfig` package's command line, with CMake as the suite expects.
- 1,000,400 parse inputs per ini subpath, made by editing ini's fixtures and test strings, the config files in `test/samples` (two `.gitconfig` files, `.npmrc`, `.editorconfig`, `php.ini`, a systemd unit, `desktop.ini`, `setup.cfg`, `my.cnf` and some odd cases, each also with CRLF endings, with a BOM, and as pkg-types' `parseGitConfig` rewrites them), and documents ini writes for random values. 970,283 of them are distinct. Each is parsed with `bracketedArray` unset, `true` and `false`, every tenth also with 10 odd options such as `null`, a string, a frozen object or a getter that changes its answer, and `safe` and `unsafe` run on each: 6,102,462 calls per subpath, with 0 differences. The comparison covers prototypes, own key order, property flags, shared references, the options object afterwards, and the error class and message. For tinyini/ini-v1, 57,450 calls differ, all in the one documented way.
- 10,000 random values per ini subpath, with nested and null-prototype objects, awkward keys and strings, arrays with holes, `undefined`, functions, symbols, BigInts, dates, `toJSON` and cycles, through all 384 combinations of the options plus 12 odd ones on every tenth value, and through the defaults on Windows: 3,851,216 calls each, plus 30,000 on Windows, with byte-identical output, the same options object afterwards, and the same error where the original throws. Every tenth value also runs behind proxies that log each read and write of the value and the options, which must come in the same order, and with every option name set on `Object.prototype`. The text then parses to the same value in both, in 3,569,892 round trips; for tinyini/ini-v1, 8,976 of them differ in the documented way.
- 1,000,083 inputs per one-ini subpath, made by editing the `.editorconfig` files of editorconfig-core-test, the samples and ini's fixtures, through `parse_to_json` as strings and `parse_to_uint32array` as UTF-8, one in five with random bytes spliced in so that some aren't UTF-8, then odd arguments, and the AST's names set on `Object.prototype` as values and as setters that log each assignment: 2,200,135 calls against 0.2.1 and 2,200,133 against 0.1.1, 0 differences, the errors for bytes that aren't UTF-8 included.
- The root against its spec: 1,000,400 parse inputs, and 10,000 random values through every option combination, whose text must parse back to the value it came from, with the changes `stringify` documents above, such as numbers read back as strings and empty arrays left out: 0 differences in 246,720 round trips.
- Every fuzzer and suite runner exits with an error on a difference or a failed test, and when a suite runs no tests. The ini and one-ini suite runners also fail when an original fails its own tests; editorconfig-core-test fails for the WASM module too in the cases listed above, so that runner fails only on a test that fails with tinyini alone.
