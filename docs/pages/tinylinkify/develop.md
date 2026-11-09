---
title: Run the checks yourself
label: Develop
description: The scripts that rerun the tests, the fuzzers, the size and the benchmarks.
---

Run these from `packages/tinylinkify` in the [repository](https://github.com/onmax/tiny).

tinylinkify is developed with pnpm 12, Node 26 and [Vite+](https://viteplus.dev) (`vp`), which runs oxlint, oxfmt, Vitest and tsdown. [tsrs](https://github.com/oxc-project/tsrs) does the typecheck. On Node, the published package needs version 22.12 or later.

```sh
pnpm install
pnpm ready      # format, build, lint, typecheck and test
pnpm test:dist  # the tests against the built dist/
```

## Run the comparisons

```sh
pnpm linkify-it-tests              # linkify-it's own tests against linkify-it and tinylinkify
node scripts/fuzz.ts 20000 1       # the drop-in against linkify-it; the second number is the seed
node scripts/versions.ts 20000     # linkify-it 3.0.3 to 5.0.2, each against the next
node scripts/fuzz-gfm.ts 20000 1   # the GFM entries against remark-gfm on plain text
node scripts/gfm-fixtures.ts       # markdown-exit with tinylinkify/gfm on the GFM fixtures; --all for every case
pnpm size                          # bundle sizes
pnpm bench                         # speed
```
