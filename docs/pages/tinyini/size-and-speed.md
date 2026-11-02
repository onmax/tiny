---
title: Size and speed
description: Bundle size and timings of each entry next to the library it replaces.
---

Each entry as npm ships it in `dist/`, bundled with esbuild, minified ESM, then gzip -9, from [`scripts/size.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyini/scripts/size.ts). An entry counts its named exports and its default export. @one-ini/wasm counts its JavaScript and its `.wasm` file, each gzipped. A KiB is 1,024 bytes. Measured on an Apple M4 with Node 26.13.0; Node on Linux gzips a few bytes larger, 1,360 B for the root rather than 1,352 B.

| Entry                  | Minified  | Gzip      |
| ---------------------- | --------- | --------- |
| `tinyini`              | 2.49 KiB  | 1.32 KiB  |
| `tinyini/ini`          | 3.15 KiB  | 1.53 KiB  |
| ini 7.0.0              | 3.46 KiB  | 1.64 KiB  |
| `tinyini/ini-v2`       | 2.78 KiB  | 1.36 KiB  |
| ini 2.0.0              | 2.89 KiB  | 1.40 KiB  |
| `tinyini/ini-v1`       | 2.75 KiB  | 1.37 KiB  |
| ini 1.3.8              | 2.89 KiB  | 1.42 KiB  |
| `tinyini/one-ini`      | 3.38 KiB  | 1.68 KiB  |
| @one-ini/wasm 0.2.1    | 91.68 KiB | 36.00 KiB |
| `tinyini/one-ini-v0.1` | 3.39 KiB  | 1.68 KiB  |
| @one-ini/wasm 0.1.1    | 87.60 KiB | 32.35 KiB |

ini is already small, so the ini subpaths save little: they look at character codes where ini runs a regular expression per line, and that takes about as much code. Importing one function leaves the rest out: `parse` alone is 0.75 KiB from `tinyini` and 0.91 KiB from `tinyini/ini`.

Each subpath is built with the branches of one core mode only: ini 4.1 for `tinyini/ini`, ini 1.x to 4.0 for `tinyini/ini-v2`, ini 1.x for `tinyini/ini-v1`, and one-ini 0.2 or 0.1 for the one-ini entries. `scripts/size.ts` fails if an entry outgrows its budget or the library it replaces, if it still holds another mode's code or behaves as another mode, if a package specifier such as `tinyini/ini-v2` loads the wrong mode, if importing one function keeps the others, or if the root stops being the smallest entry.

## Speed

Median time per call over seven rounds, from [`bench/index.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyini/bench/index.ts), on the built `dist/` (Apple M4, Node 26.13.0; the table at the top comes from another run on the same machine, where ini 7's large stringify is 2.9x faster rather than 2.5x). The two sides' rounds interleave, and which runs first alternates. The inputs are ini's `foo.ini` fixture, a `.gitconfig`, and about 100 KB of generated sections, comments, quoted values, escapes and arrays; stringify writes what ini 7 reads from each, with `whitespace: true`. For @one-ini/wasm, "parse" is `parse_to_uint32array` on the file's bytes, which is what `editorconfig` calls, and the inputs are an `.editorconfig` and 100 KB of generated EditorConfig sections.

| Library                                      | Operation                   |  Library |  tinyini | Speedup |
| -------------------------------------------- | --------------------------- | -------: | -------: | ------: |
| ini 7.0.0 → `tinyini/ini`                    | parse foo.ini               |  20.3 µs |  10.5 µs |    1.9x |
|                                              | parse .gitconfig            |  18.4 µs |   7.6 µs |    2.4x |
|                                              | parse large                 |  1.36 ms | 781.2 µs |    1.7x |
|                                              | stringify foo.ini           |  10.6 µs |   4.9 µs |    2.2x |
|                                              | stringify .gitconfig        |  14.9 µs |   7.3 µs |    2.0x |
|                                              | stringify large             |  1.17 ms | 471.2 µs |    2.5x |
| ini 2.0.0 → `tinyini/ini-v2`                 | parse foo.ini               |  22.4 µs |  11.2 µs |    2.0x |
|                                              | parse .gitconfig            |  20.0 µs |   7.9 µs |    2.5x |
|                                              | parse large                 |  1.40 ms | 878.2 µs |    1.6x |
|                                              | stringify foo.ini           |   7.6 µs |   4.9 µs |    1.5x |
|                                              | stringify .gitconfig        |  11.3 µs |   8.5 µs |    1.3x |
|                                              | stringify large             | 846.6 µs | 525.3 µs |    1.6x |
| ini 1.3.8 → `tinyini/ini-v1`                 | parse foo.ini               |  20.3 µs |  11.3 µs |    1.8x |
|                                              | parse .gitconfig            |  20.4 µs |   8.0 µs |    2.6x |
|                                              | parse large                 |  1.40 ms | 854.9 µs |    1.6x |
|                                              | stringify foo.ini           |   7.7 µs |   5.0 µs |    1.6x |
|                                              | stringify .gitconfig        |  11.5 µs |   8.5 µs |    1.3x |
|                                              | stringify large             | 884.3 µs | 534.3 µs |    1.7x |
| @one-ini/wasm 0.2.1 → `tinyini/one-ini`      | parse .editorconfig         | 107.6 µs |   4.7 µs |   22.9x |
|                                              | parse large                 |  7.18 ms | 576.6 µs |   12.4x |
|                                              | parse_to_json .editorconfig | 141.9 µs |   4.1 µs |   34.9x |
|                                              | parse_to_json large         |  9.18 ms | 685.4 µs |   13.4x |
| @one-ini/wasm 0.1.1 → `tinyini/one-ini-v0.1` | parse .editorconfig         |  77.1 µs |   4.6 µs |   16.8x |
|                                              | parse large                 |  6.89 ms | 560.1 µs |   12.3x |
|                                              | parse_to_json .editorconfig | 102.4 µs |   4.1 µs |   24.7x |
|                                              | parse_to_json large         |  9.08 ms | 718.0 µs |   12.7x |

The root, tinyini's own API, against ini 7.0.0 and against each ini subpath, on the same inputs:

| Against          | parse foo.ini | parse .gitconfig | parse large | stringify foo.ini | stringify .gitconfig | stringify large |
| ---------------- | ------------: | ---------------: | ----------: | ----------------: | -------------------: | --------------: |
| ini 7.0.0        |          2.6x |             3.2x |        2.3x |              2.9x |                 2.5x |            3.4x |
| `tinyini/ini`    |          1.3x |             1.3x |        1.3x |              1.4x |                 1.3x |            1.4x |
| `tinyini/ini-v2` |          1.3x |             1.2x |        1.3x |              1.4x |                 1.5x |            1.6x |
| `tinyini/ini-v1` |          1.3x |             1.2x |        1.3x |              1.4x |                 1.5x |            1.6x |
