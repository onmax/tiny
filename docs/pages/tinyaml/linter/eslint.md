---
title: ESLint
description: Run the tinyaml linter rules from ESLint with tinyaml/eslint.
---

`tinyaml/eslint` runs the [linter's rules](/tinyaml/linter/overview/#rules) as ESLint rules, so YAML problems show up wherever ESLint runs, in your editor and in CI.

## Setup

It needs ESLint 9.15 or later and `yaml-eslint-parser` 2 or later, which parses the YAML for ESLint.

```sh
pnpm add -D tinyaml eslint yaml-eslint-parser
```

Add the `recommended` config to `eslint.config.js`:

```js
// eslint.config.js
import tinyaml from "tinyaml/eslint";

export default [tinyaml.configs.recommended];
```

It lints `**/*.{yaml,yml}` and turns both rules on: `tinyaml/invalid-yaml` as an error, `tinyaml/ambiguous-value` as a warning. Then run it:

```sh
pnpm eslint .
```

```txt
config.yaml
  1:8  warning  `no` loads as the string "no", but PyYAML and yaml's YAML 1.1 schema read it as a boolean. Quote it to keep the string, or write `true` or `false`  tinyaml/ambiguous-value

site.yaml
  2:10  error  tinyaml can't load this YAML: mapping keys must be strings, numbers, booleans or null. Fix the YAML at this position  tinyaml/invalid-yaml
```

YAML that `yaml-eslint-parser` can't parse, such as a duplicated key, shows up as an ESLint parsing error instead of under `tinyaml/invalid-yaml`.

## Change a rule's severity

Set the rule in `rules` after the recommended config:

```js
// eslint.config.js
import tinyaml from "tinyaml/eslint";

export default [
  tinyaml.configs.recommended,
  {
    files: ["**/*.{yaml,yml}"],
    rules: { "tinyaml/ambiguous-value": "error" },
  },
];
```

To lint other files, such as `.yaml.tmpl`, copy the config with your own `files`:

```js
export default [{ ...tinyaml.configs.recommended, files: ["**/*.yaml.tmpl"] }];
```
