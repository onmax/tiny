---
title: tiny
description: Smaller, faster drop-ins for js-yaml, yaml, yamljs, @std/yaml, json5 and ini.
headline: Smaller, faster parsers. Same API.
tagline: Drop-in replacements for the YAML, JSON5 and INI libraries you already use, with no dependencies. Change one import and keep your code.
install: pnpm add tinyaml tinyjson5 tinyini
---

::code-group
```ts [tinyaml] icon=lucide:file-code del={1} ins={2}
import yaml from "js-yaml";
import yaml from "tinyaml/js-yaml";
```

```ts [tinyjson5] icon=lucide:braces del={1} ins={2}
import JSON5 from "json5";
import JSON5 from "tinyjson5/json5";
```

```ts [tinyini] icon=lucide:settings-2 del={1} ins={2}
import ini from "ini";
import ini from "tinyini/ini";
```
::

## One package per format

Each is published on its own, so you install only what you use.

::packages
::

## Next to what they replace

<!-- automd:drop-ins -->

| You use               | Switch to                          |      Size, gzip |       Parses | Stringifies |
| --------------------- | ---------------------------------- | --------------: | -----------: | ----------: |
| js-yaml 4             | `tinyaml/js-yaml`                  | 14.4 → 11.6 KiB |  1.6× faster | 1.7× faster |
| js-yaml 5             | `tinyaml/js-yaml-v5`               | 17.0 → 16.1 KiB |  1.5× faster | 1.8× faster |
| yaml                  | `tinyaml/yaml`                     | 29.8 → 16.8 KiB | 12.0× faster | 2.8× faster |
| yamljs                | `tinyaml/yamljs`                   |   8.8 → 8.0 KiB |  5.1× faster | 1.1× faster |
| @std/yaml             | `tinyaml/std`                      | 11.2 → 10.6 KiB |  2.4× faster | 1.6× faster |
| json5 2.2.3           | `tinyjson5/json5`                  |   7.5 → 3.2 KiB |  7.4× faster | 4.7× faster |
| json5 1.0.2           | `tinyjson5/json5-v1`               |   8.3 → 3.3 KiB |  7.1× faster | 5.1× faster |
| strip-json-comments 3 | `tinyjson5/strip-json-comments`    |   0.7 → 0.5 KiB |  3.8× faster |           — |
| strip-json-comments 2 | `tinyjson5/strip-json-comments-v2` |   0.6 → 0.5 KiB |  4.2× faster |           — |
| strip-json-comments 5 | `tinyjson5/strip-json-comments-v5` |   0.6 → 0.6 KiB |  3.6× faster |           — |
| jsonc-parser 3.3.1    | `tinyjson5/jsonc-parser`           |   6.6 → 5.7 KiB |  1.2× faster |           — |
| comment-json 4.6.2    | `tinyjson5/comment-json`           | 35.3 → 18.2 KiB |  1.8× faster | 1.3× faster |
| jju 1.4.0             | `tinyjson5/jju`                    |   9.6 → 9.5 KiB |  1.1× faster | 1.6× faster |
| ini 7.0.0             | `tinyini/ini`                      |   1.6 → 1.5 KiB |  1.8× faster | 2.9× faster |
| ini 2.0.0             | `tinyini/ini-v2`                   |   1.4 → 1.4 KiB |  1.6× faster | 1.6× faster |
| ini 1.3.8             | `tinyini/ini-v1`                   |   1.4 → 1.4 KiB |  1.6× faster | 1.7× faster |
| @one-ini/wasm 0.2.1   | `tinyini/one-ini`                  |  36.0 → 1.7 KiB | 12.4× faster |           — |
| @one-ini/wasm 0.1.1   | `tinyini/one-ini-v0.1`             |  32.3 → 1.7 KiB | 12.1× faster |           — |

Starting fresh with YAML? The root `tinyaml` API is 7.7 KiB, 1.9× smaller than js-yaml 4 and 3.9× smaller than yaml. It parses 18.7× faster than yaml and stringifies 12.9× faster.

Size is the minified bundle, gzipped. Speed is the median time to parse and stringify each package's large benchmark file. @one-ini/wasm's size adds its .wasm file, gzipped, and its speed is parse_to_uint32array on a 100 KB .editorconfig. strip-json-comments only strips comments, so its time is the time to strip them. Measured on Apple M4, Node 26.13.0.

<!-- /automd -->

## Questions

::accordion
:::accordion-item{label="How close is each package to the library it replaces?"}
Each one runs the original library's own tests and is compared with it on fuzzed inputs: 1 million for tinyjson5, 6 million calls for tinyini, and every yaml-test-suite case plus thousands of edits for tinyaml. Each package's compatibility page lists every known difference: [tinyaml](/tinyaml/guide/switching/), [tinyjson5](/tinyjson5/compatibility/), [tinyini](/tinyini/compatibility/).
:::

:::accordion-item{label="Can I load them with require()?"}
Yes. All three ship ESM only, and Node 22.12 and later load ESM from `require()`. Bundlers handle them too.
:::

:::accordion-item{label="Why are they faster?"}
Each parser reads character codes in one pass and builds JavaScript values directly, without a tokenizer or a syntax tree in between. tinyjson5's ports of jsonc-parser, comment-json and jju keep the scanner or tokenizer their API exposes, and are faster at it.
:::

:::accordion-item{label="How are the numbers measured?"}
With scripts in the repository that you can rerun. Each package has a page with the commands: [tinyaml](/tinyaml/numbers/reproduce/), [tinyjson5](/tinyjson5/develop/), [tinyini](/tinyini/develop/).
:::
::
