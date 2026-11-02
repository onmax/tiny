---
title: Run the checks yourself
label: Develop
description: The scripts that rerun the tests, the fuzzers, the size and the benchmarks.
---

Run these from `packages/tinyini` in the [repository](https://github.com/onmax/tiny).

tinyini is developed with pnpm 12, Node 26 and [Vite+](https://viteplus.dev) (`vp`), which runs oxlint, oxfmt, Vitest and tsdown. [tsrs](https://github.com/oxc-project/tsrs) does the typecheck. On Node, the published package needs version 22 or later.

```sh
pnpm install
pnpm ready      # format, build, lint, typecheck and test
pnpm test:dist  # the tests against the built dist/
```

## Run the comparisons

```sh
pnpm ini-tests                        # ini's own tests against each ini and its tinyini subpath
pnpm one-ini-tests                    # one-ini's Rust tests with each @one-ini/wasm and tinyini
pnpm editorconfig-tests               # editorconfig-core-test with each @one-ini/wasm and tinyini (needs CMake)
node scripts/fuzz.ts 1000000 1 ini    # parse fuzzing; also ini-v2 or ini-v1
node scripts/fuzz-stringify.ts 10000 1 ini
node scripts/one-ini-fuzz.ts 1000000 1 one-ini   # or one-ini-v0.1
node scripts/root-fuzz.ts 1000000 10000 1        # the root against scripts/root-spec.ts
node scripts/versions.ts 20000        # 15 ini versions, each against the next
node scripts/depth.ts                 # how deep each entry writes
pnpm size                             # bundle sizes
pnpm bench                            # speed
```
