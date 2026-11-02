---
title: Vite Doctor
description: Add the tinyaml linter rules to a Vite Doctor run with tinyaml/doctor.
---

![A terminal running Vite Doctor with tinyaml/doctor: two TINYAML0002 warnings for site.yaml, each with its fix, location and docs link](/demos/doctor.png)

`tinyaml/doctor` adds the [linter's rules](/tinyaml/linter/overview/#rules) to a [Vite Doctor](https://github.com/onmax/vite-doctor) run, so one report covers your code and your YAML.

## Setup

It needs `vite-doctor` 0.1.1 or later, which needs Node 22.20 or later. On older Node, Vite Doctor finds no files and reports nothing.

In TypeScript, set `moduleResolution` to `node16`, `nodenext`, or `bundler`, as Vite Doctor requires. `vite-doctor` declares `vite-doctor/config` and `vite-doctor/extension` only in its `exports`, which the legacy `node` resolution doesn't read.

```sh
pnpm add -D tinyaml vite-doctor
```

Vite Doctor loads extensions from an executable config, so register it in `doctor.config.ts`:

```ts
// doctor.config.ts
import tinyaml from "tinyaml/doctor";
import { defineDoctorConfig } from "vite-doctor/config";

export default defineDoctorConfig({
  extends: ["auto", "tinyaml/recommended"],
  extensions: [tinyaml()],
});
```

`tinyaml/recommended` turns on both rules and goes in `extends` with Vite Doctor's own presets. Then run it:

```sh
pnpm vite-doctor . --config doctor.config.ts
```

Each problem has its own code, `TINYAML0001` or `TINYAML0002`, which links to the rule's section in the [linter docs](/tinyaml/linter/overview/#rules). Each diagnostic carries `why`, `fix`, and the YAML location in `sources`.

## Options

| Option    | Default                            | Description                                      |
| --------- | ---------------------------------- | ------------------------------------------------ |
| `include` | `**/*.{yaml,yml}`                  | The YAML to check, relative to the project root. |
| `exclude` | `**/node_modules/**`, `**/dist/**` | Globs to skip.                                   |

## This repository

tinyaml runs Vite Doctor on itself with `pnpm check:doctor`. Its [`doctor.config.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyaml/doctor.config.ts) loads the extension from `src/` and adds `.cache/` to `exclude`, since the conformance scripts clone test suites there.
