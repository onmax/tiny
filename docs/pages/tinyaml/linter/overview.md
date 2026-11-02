---
title: Linter
description: Check YAML the way tinyaml loads it, from the command line, as a library, in ESLint or in Vite Doctor.
---

The linter checks YAML files the way tinyaml loads them. It reports YAML tinyaml can't load, with the line and column, and plain values that load as strings here but that other YAML readers take for a boolean, a number, or a date.

It runs from the command line, as a library, as an [ESLint](/tinyaml/linter/eslint/) plugin, or as a [Vite Doctor](/tinyaml/linter/vite-doctor/) extension. It all ships with tinyaml. The command line and the library need nothing else, and the ESLint plugin and the Vite Doctor extension need ESLint or Vite Doctor installed.

## Command line

```sh
pnpm add -D tinyaml
pnpm tinyaml-lint "**/*.{yaml,yml}"
```

It prints one line per problem and exits with 1 if there are any:

```txt
config.yaml:1:8 tinyaml/ambiguous-value `no` loads as the string "no", but PyYAML and yaml's YAML 1.1 schema read it as a boolean. Quote it to keep the string, or write `true` or `false`.
site.yaml:3:13 tinyaml/invalid-yaml tinyaml can't load this YAML: duplicated mapping key. Fix the YAML at this position.
```

Globs skip `node_modules` and `dist`. `--format json` prints the problems as a JSON array instead.

## Library

```ts
import { lint } from "tinyaml/linter";

lint("draft: no\n");
// [{ rule: "tinyaml/ambiguous-value", severity: "warn", line: 1, column: 8, offset: 7, message: "…", fix: "…" }]
```

`lint` takes one YAML stream and never throws. Lines and columns count from 1 and offsets from 0, in the text as given; as in ESLint, columns start past a byte order mark at the start of the text. `lintFiles(files, read)` lints several files, reading each one with `read`. `rules` maps each rule to its Vite Doctor code, title, and severity.

## Rules

| Rule                                                 | Code          | Severity | Reports                                                 |
| ---------------------------------------------------- | ------------- | -------- | ------------------------------------------------------- |
| [`tinyaml/invalid-yaml`](#tinyamlinvalid-yaml)       | `TINYAML0001` | error    | YAML tinyaml can't load                                 |
| [`tinyaml/ambiguous-value`](#tinyamlambiguous-value) | `TINYAML0002` | warning  | A plain value other YAML readers don't read as a string |

### `tinyaml/invalid-yaml`

tinyaml throws on this YAML, so `parse` and `parseAll` fail. The linter reports tinyaml's message at the line and column it names.

```yaml
# ❌ the second `title` throws `duplicated mapping key`
title: Hello
title: World
```

```yaml
# ✅
title: Hello
```

### `tinyaml/ambiguous-value`

tinyaml reads YAML with the YAML 1.2 core schema, as js-yaml 5 and the `yaml` package do by default. Other readers turn more plain values into something else, so the same file gives different data depending on who reads it:

| Values                              | Read as   | By                                                   |
| ----------------------------------- | --------- | ---------------------------------------------------- |
| `yes`, `no`, `on`, `off`            | a boolean | PyYAML, yaml's YAML 1.1 schema                       |
| `y`, `n`                            | a boolean | yaml's YAML 1.1 schema                               |
| `0b10`, `-0x10`                     | a number  | js-yaml 4, @std/yaml, PyYAML, yaml's YAML 1.1 schema |
| `1_000`, `.1_0`                     | a number  | @std/yaml, PyYAML, yaml's YAML 1.1 schema            |
| `12:30:00`                          | a number  | PyYAML, yaml's YAML 1.1 schema                       |
| `2026-11-01`, `2026-11-01 12:00:00` | a date    | js-yaml 4, @std/yaml, PyYAML, yaml's YAML 1.1 schema |

Each warning names the readers that read its value otherwise. yaml's YAML 1.1 schema is the `yaml` package with `version: "1.1"`. Values tinyaml already parses as booleans, null, or numbers, such as `True`, `~`, `0x10`, and `.inf`, are not reported.

```yaml
# ❌ a string here, a boolean in PyYAML
draft: no
```

```yaml
# ✅ the same in every reader
draft: false
title: "no"
```

Quote the value to keep the string, or write the JSON value you meant. Quoted values, block scalars, and comments are never reported.
