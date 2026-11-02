<h1>
  <img src="./.github/banner.svg" alt="tinyaml" width="100%">
</h1>

<!-- automd:comark-badges name=tinyaml size=size-and-speed -->

[![release](https://comark-ui.onmax.me/badge.svg?source=npm-version&package=tinyaml&label=release&icon=npm)](https://github.com/onmax/tiny/releases)
[![size](https://comark-ui.onmax.me/badge.svg?label=size&value=7.7+KiB+gzip)](#size-and-speed)
[![dependencies](https://comark-ui.onmax.me/badge.svg?label=dependencies&value=0)](https://www.npmjs.com/package/tinyaml?activeTab=dependencies)
[![license: MIT](https://comark-ui.onmax.me/badge.svg?label=license&value=MIT)](./LICENSE)
[![Release status](https://comark-ui.onmax.me/badge.svg?source=github-actions&repository=onmax%2Ftiny&workflow=release.yaml&icon=github)](https://github.com/onmax/tiny/actions/workflows/release.yaml)

<!-- /automd -->

**YAML for JavaScript in 7.8 KiB.** No dependencies, 12–19× faster than yaml, and right on all 373 [yaml-test-suite](https://github.com/yaml/yaml-test-suite) cases with an expected result: every valid document read, every invalid one rejected. js-yaml, yaml, yamljs and @std/yaml each miss some.

Already on another YAML library? Change one import and keep your code:

```diff
- import yaml from "js-yaml";
+ import yaml from "tinyaml/js-yaml";
```

tinyaml ships drop-in replacements for js-yaml 4 and 5, yaml, yamljs and @std/yaml. Each drop-in is checked against the original library's own tests and thousands of fuzzed inputs. [Switching](https://tiny.onmax.me/tinyaml/guide/switching) lists what each one does differently.

## Size and speed

<!-- automd:drop-ins package=tinyaml -->

| You use   | Switch to            |      Size, gzip |       Parses | Stringifies |
| --------- | -------------------- | --------------: | -----------: | ----------: |
| js-yaml 4 | `tinyaml/js-yaml`    | 14.4 → 11.6 KiB |  1.6× faster | 1.7× faster |
| js-yaml 5 | `tinyaml/js-yaml-v5` | 17.0 → 16.1 KiB |  1.5× faster | 1.8× faster |
| yaml      | `tinyaml/yaml`       | 29.8 → 16.9 KiB | 12.0× faster | 2.8× faster |
| yamljs    | `tinyaml/yamljs`     |   8.8 → 8.1 KiB |  5.1× faster | 1.1× faster |
| @std/yaml | `tinyaml/std`        | 11.2 → 10.7 KiB |  2.4× faster | 1.6× faster |

For new code, the root `tinyaml` API is 7.7 KiB, 1.9× smaller than js-yaml 4 and 3.9× smaller than yaml. It parses 18.7× faster than yaml and stringifies 12.9× faster.

Size is the minified bundle, gzipped. Speed is the median time to parse and stringify the large benchmark file. Measured on Apple M4, Node 26.13.0.

<!-- /automd -->

### Bugs tinyaml doesn't copy

| Library                   | Bug                                                                                                                                | tinyaml                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| js-yaml 4.1.0 and earlier | A `<<` merge of a mapping that has a `__proto__` key replaces the merged object's prototype (CVE-2025-64718).                      | tinyaml/js-yaml keeps `__proto__` as an ordinary key, as js-yaml 4.1.1 and later do. |
| js-yaml 4.3.2             | Loads `key: &x\n!!map\n  a: b`, which is invalid YAML (yaml-test-suite H7J7), as `{ key: { a: "b" } }`.                            | tinyaml/js-yaml throws.                                                              |
| yaml 2.9.1                | A lone carriage return isn't a line break, so `- a\r- b` loads as `["a\r- b"]`. The YAML spec makes it a line break.               | tinyaml/yaml gives `["a", "b"]`.                                                     |
| yaml 2.9.1                | Warnings on one long line take quadratic time: 60,000 unknown tags in one flow sequence take about 15 seconds on a Ryzen 7 laptop. | tinyaml/yaml takes about half a second.                                              |
| yamljs 0.3.0              | Drops keys named like `Object.prototype` members: `constructor: 1` and `__proto__: {x: 1}` load as `null`.                         | tinyaml/yamljs keeps them.                                                           |
| yamljs 0.3.0              | `- - a` loads as `["- a"]`.                                                                                                        | tinyaml/yamljs gives `[["a"]]`.                                                      |
| yamljs 0.3.0              | A plain value over two lines keeps the line break: `a: x\n  y` gives `"x\ny"`.                                                     | tinyaml/yamljs gives `"x y"`.                                                        |
| yamljs 0.3.0              | `\u` and `\x` escapes give UTF-8 bytes: `"\u00e9"` gives `"Ã©"`.                                                                   | tinyaml/yamljs gives `"é"`.                                                          |
| yamljs 0.3.0              | A quoted string that starts with `*` is read as an alias: `["*a"]` gives `[undefined]`.                                            | tinyaml/yamljs gives `["*a"]`.                                                       |
| @std/yaml 1.3.0           | Throws on an anchor before a block mapping key, as in `&a a: b` (yaml-test-suite ZH7C).                                            | tinyaml/std gives `{ a: "b" }`.                                                      |
| @std/yaml 1.3.0           | Keeps a tab that ends a line in a double-quoted scalar: `"a\t\n  b"` gives `"a\t b"` (yaml-test-suite DE56).                       | tinyaml/std gives `"a b"`.                                                           |
| @std/yaml 1.3.0           | Loads the invalid `[ , a ]` as `[null, "a"]` (yaml-test-suite 9MAG).                                                               | tinyaml/std throws.                                                                  |

## Get started

```sh
pnpm add tinyaml
```

tinyaml ships ESM only. Node 22.12 and later load it with `import` or `require()`, and so do bundlers.

```ts
import { parse, parseAll, stringify } from "tinyaml";

parse("title: Hello\ntags: [a, b]\ncount: 0x1F"); // { title: "Hello", tags: ["a", "b"], count: 31 }
parseAll("a: 1\n---\nb: 2"); // [{ a: 1 }, { b: 2 }]
stringify({ title: "Hello", draft: false, answer: "yes" }); // "title: Hello\ndraft: false\nanswer: 'yes'\n"
```

Values follow the YAML 1.2 core schema, merge keys are on by default, and errors carry a line and column. The [docs](https://tiny.onmax.me) cover the rest:

- [Get started](https://tiny.onmax.me/tinyaml/guide/getting-started): values, merge keys, custom tags, errors and `stringify`
- [Switching](https://tiny.onmax.me/tinyaml/guide/switching): what each drop-in does differently from the library it replaces
- [API](https://tiny.onmax.me/tinyaml/guide/api): every function and option
- [Size](https://tiny.onmax.me/tinyaml/numbers/size), [speed](https://tiny.onmax.me/tinyaml/numbers/speed), [correctness](https://tiny.onmax.me/tinyaml/numbers/correctness) and [how it compares](https://tiny.onmax.me/tinyaml/numbers/comparison), with [the scripts to rerun them](https://tiny.onmax.me/tinyaml/numbers/reproduce)

## Linter

`tinyaml-lint` reports YAML tinyaml can't parse, and plain values such as `no` or `1_000` that parse as strings here but not in other YAML readers. It also runs as a library (`tinyaml/linter`), an [ESLint plugin](https://tiny.onmax.me/tinyaml/linter/eslint/) (`tinyaml/eslint`), and a [Vite Doctor extension](https://tiny.onmax.me/tinyaml/linter/vite-doctor/) (`tinyaml/doctor`). See [the linter docs](https://tiny.onmax.me/tinyaml/linter/overview/).

```sh
pnpm tinyaml-lint "**/*.{yaml,yml}"
```

An independent project by [@onmax](https://github.com/onmax).

## Develop

tinyaml is developed with pnpm 12, Node 26 and [Vite+](https://viteplus.dev) (`vp`).

```sh
pnpm install
pnpm --filter tinyaml fixtures  # the comparison tests need the upstream suites and fixtures
pnpm --filter tinyaml ready     # format, build, lint, typecheck and test
```

The website lives in the repository's [`docs/`](../../docs); `pnpm docs:dev` from the root runs it.

## License

[MIT](./LICENSE). The drop-in entries follow the code of js-yaml, yaml, yamljs and @std/yaml, so [LICENSE](./LICENSE) also carries those libraries' notices.
