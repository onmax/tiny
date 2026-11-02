---
title: Size and speed
description: Bundle size and timings of each entry next to the library it replaces.
---

Bundled with esbuild, minified ESM, every export kept, then gzip -9 (`pnpm size`):

| Entry                              | Minified |     Gzip | Original                  |  Minified |     Gzip |
| ---------------------------------- | -------: | -------: | ------------------------- | --------: | -------: |
| `tinyjson5`                        |  8.5 KiB |  3.4 KiB | json5 2.2.3               |  26.5 KiB |  7.6 KiB |
| `tinyjson5/json5`                  |  7.8 KiB |  3.2 KiB | json5 2.2.3               |  26.5 KiB |  7.6 KiB |
| `tinyjson5/json5-v1`               |  8.0 KiB |  3.3 KiB | json5 1.0.2               |  29.2 KiB |  8.4 KiB |
| `tinyjson5/strip-json-comments`    |  0.9 KiB |  0.5 KiB | strip-json-comments 3.1.1 |   1.3 KiB |  0.8 KiB |
| `tinyjson5/strip-json-comments-v2` |  0.9 KiB |  0.5 KiB | strip-json-comments 2.0.1 |   1.2 KiB |  0.7 KiB |
| `tinyjson5/strip-json-comments-v5` |  1.1 KiB |  0.6 KiB | strip-json-comments 5.0.3 |   1.1 KiB |  0.6 KiB |
| `tinyjson5/jsonc-parser`           | 16.7 KiB |  5.7 KiB | jsonc-parser 3.3.1        |  19.7 KiB |  6.6 KiB |
| `tinyjson5/comment-json`           | 59.8 KiB | 18.4 KiB | comment-json 4.6.2        | 151.8 KiB | 35.7 KiB |
| `tinyjson5/jju`                    | 28.0 KiB |  9.7 KiB | jju 1.4.0                 |  28.4 KiB |  9.8 KiB |

jju needs Node's `fs` and `assert`, so it's measured for Node, without them. Each entry is built on its own, so it carries no code of another; the root carries json5 3's additions and the `jsonc` mode, which put it above `tinyjson5/json5`.

## Speed

Every entry is faster than its original at every operation benchmarked, from 1.06× (jsonc-parser's `format` of the tsconfig) to 8.9×. `pnpm bench` times each entry against its original, on the built `dist/`, with a 14-line tsconfig, json5's own `test.json5`, and json5 2.2.3's package-lock.json as 220 KB of JSON5 and 229 KB of JSON with comments. Each time is the median of 7 runs, measured on an Apple M4, Node 26.13.0:

| Original                      | Operation            | Original | tinyjson5 | Speedup |
| ----------------------------- | -------------------- | -------: | --------: | ------: |
| json5 2.2.3                   | parse tsconfig       |  13.1 µs |    1.5 µs |   8.88× |
| json5 2.2.3                   | stringify tsconfig   |   2.8 µs |    901 ns |   3.06× |
| json5 2.2.3                   | parse test.json5     |   1.1 µs |    129 ns |   8.89× |
| json5 2.2.3                   | stringify test.json5 |   162 ns |    117 ns |   1.39× |
| json5 2.2.3                   | parse large          |  7.27 ms |  911.3 µs |   7.98× |
| json5 2.2.3                   | stringify large      |  2.11 ms |  464.3 µs |   4.55× |
| json5 1.0.2                   | parse tsconfig       |  12.1 µs |    1.5 µs |   8.29× |
| json5 1.0.2                   | stringify tsconfig   |   2.8 µs |    867 ns |   3.25× |
| json5 1.0.2                   | parse test.json5     |   1.1 µs |    132 ns |   8.28× |
| json5 1.0.2                   | stringify test.json5 |   159 ns |    125 ns |   1.27× |
| json5 1.0.2                   | parse large          |  6.70 ms |  894.7 µs |   7.49× |
| json5 1.0.2                   | stringify large      |  2.27 ms |  462.3 µs |   4.91× |
| strip-json-comments 3         | strip tsconfig       |   3.5 µs |    683 ns |   5.06× |
| strip-json-comments 3         | strip large          |  2.28 ms |  618.8 µs |   3.69× |
| strip-json-comments 2         | strip tsconfig       |   3.9 µs |    711 ns |   5.43× |
| strip-json-comments 2         | strip large          |  2.59 ms |  609.8 µs |   4.24× |
| strip-json-comments 5         | strip tsconfig       |   3.5 µs |    717 ns |   4.93× |
| strip-json-comments 5         | strip large          |  2.38 ms |  653.3 µs |   3.64× |
| jsonc-parser 3.3.1            | parse tsconfig       |   2.7 µs |    2.4 µs |   1.15× |
| jsonc-parser 3.3.1            | parseTree tsconfig   |   3.1 µs |    2.7 µs |   1.15× |
| jsonc-parser 3.3.1            | visit tsconfig       |   2.3 µs |    2.1 µs |   1.10× |
| jsonc-parser 3.3.1            | format tsconfig      |   2.3 µs |    2.1 µs |   1.06× |
| jsonc-parser 3.3.1            | parse large          |  1.38 ms |   1.17 ms |   1.18× |
| jsonc-parser 3.3.1            | parseTree large      |  1.39 ms |   1.15 ms |   1.21× |
| jsonc-parser 3.3.1            | visit large          |  1.17 ms |  979.3 µs |   1.19× |
| jsonc-parser 3.3.1            | format large         |  1.22 ms |   1.04 ms |   1.18× |
| comment-json 4.6.2            | parse tsconfig       |  10.3 µs |    6.2 µs |   1.66× |
| comment-json 4.6.2            | stringify tsconfig   |   5.2 µs |    4.0 µs |   1.28× |
| comment-json 4.6.2            | parse large          |  7.07 ms |   3.59 ms |   1.97× |
| comment-json 4.6.2            | stringify large      |  2.79 ms |   1.95 ms |   1.43× |
| jju 1.4.0                     | parse tsconfig       |   3.7 µs |    3.1 µs |   1.18× |
| jju 1.4.0                     | stringify tsconfig   |   3.6 µs |    2.0 µs |   1.85× |
| jju 1.4.0                     | parse test.json5     |   420 ns |    397 ns |   1.06× |
| jju 1.4.0                     | stringify test.json5 |   338 ns |    316 ns |   1.07× |
| jju 1.4.0                     | parse large          |  1.81 ms |   1.50 ms |   1.21× |
| jju 1.4.0                     | stringify large      |  1.58 ms |  955.7 µs |   1.65× |
| json5 2.2.3, against the root | parse tsconfig       |  12.9 µs |    1.6 µs |   8.01× |
| json5 2.2.3, against the root | stringify tsconfig   |   2.8 µs |    961 ns |   2.87× |
| json5 2.2.3, against the root | parse test.json5     |   1.2 µs |    146 ns |   7.88× |
| json5 2.2.3, against the root | stringify test.json5 |   163 ns |    127 ns |   1.28× |
| json5 2.2.3, against the root | parse large          |  7.31 ms |   1.03 ms |   7.11× |
| json5 2.2.3, against the root | stringify large      |  2.13 ms |  505.6 µs |   4.22× |
