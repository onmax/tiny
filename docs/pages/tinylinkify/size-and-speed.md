---
title: Size and speed
description: Bundle size and timings of each entry next to linkify-it.
---

Each entry as npm ships it in `dist/`, bundled with esbuild, minified ESM, then gzip -9, from [`scripts/size.ts`](https://github.com/onmax/tiny/blob/main/packages/tinylinkify/scripts/size.ts). An entry counts its named exports and its default export. A KiB is 1,024 bytes. Measured on Linux with Node 24.21.0.

| Entry                    | Minified  | Gzip     |
| ------------------------ | --------- | -------- |
| `tinylinkify`            | 3.55 KiB  | 1.79 KiB |
| `tinylinkify/gfm`        | 4.65 KiB  | 2.22 KiB |
| `tinylinkify/linkify-it` | 9.94 KiB  | 3.77 KiB |
| linkify-it 5.0.2         | 11.25 KiB | 4.11 KiB |
| linkify-it 6.1.0         | 13.30 KiB | 4.40 KiB |

Most of linkify-it is its patterns, which the drop-in keeps, so it saves what uc.micro's punctuation table weighed, less the code that builds the class and the shortcuts. The GFM entries share one search; `tinylinkify/gfm` adds the interface around it, and is half the size of linkify-it 6.1.0, which markdown-it 15 and markdown-exit 2 use. `scripts/size.ts` fails if an entry outgrows its budget or linkify-it, if one entry bundles another's code, if a package specifier such as `tinylinkify/gfm` loads the wrong entry, or if the root stops being the smallest.

## Speed

Median time per call over seven rounds, from [`bench/index.ts`](https://github.com/onmax/tiny/blob/main/packages/tinylinkify/bench/index.ts), on the built `dist/` (AMD Ryzen 7 255, Node 24.21.0, on a machine other jobs share). The two sides' rounds interleave, and which runs first alternates. The inputs are linkify-it's five benchmark samples, 52 chat messages full of `@mentions`, and about 100 KB of all of them; the call is the one markdown-it makes, `match` after a `pretest` that passes. The GFM entries find GFM's links, not linkify-it's, so theirs is the same work on the same text, not the same result. linkify-it 6.1.0 has no `pretest`, so its rows are `test` and then `match`, as markdown-it 15 and markdown-exit 2 call it, each on a new `tinylinkify/gfm`, since it keeps the links of the last text it matched, which a benchmark repeating one text would reuse. linkify-it 6 links no fuzzy domains by default, so on linkify-it's samples, which are mostly those, it does a fraction of the work and is 4 to 8 times faster than `tinylinkify/gfm`; on 100 KB it's 1.3 times faster. The last rows are markdown-exit rendering the chat messages with each linkifier, markdown-exit 2 on its core, where you set the linkifier.

| Library                                         | Operation         |  Library | tinylinkify | Speedup |
| ----------------------------------------------- | ----------------- | -------: | ----------: | ------: |
| linkify-it 5.0.2 → `tinylinkify/linkify-it`     | match chat        | 202.2 µs |    157.5 µs |    1.3x |
|                                                 | match email_fuzzy |  80.7 µs |     67.1 µs |    1.2x |
|                                                 | match link_fuzzy  |  80.7 µs |     66.9 µs |    1.2x |
|                                                 | match link_normal |  86.3 µs |     71.6 µs |    1.2x |
|                                                 | match many        |  70.4 µs |     61.5 µs |    1.1x |
|                                                 | match many_fast   |  69.4 µs |     59.9 µs |    1.2x |
|                                                 | match large       |  5.65 ms |     5.55 ms |    1.0x |
| linkify-it 5.0.2 → `tinylinkify/gfm`            | match chat        | 203.8 µs |     61.8 µs |    3.3x |
|                                                 | match email_fuzzy |  82.5 µs |     62.6 µs |    1.3x |
|                                                 | match link_fuzzy  |  80.6 µs |     61.2 µs |    1.3x |
|                                                 | match link_normal |  86.8 µs |     29.7 µs |    2.9x |
|                                                 | match many        |  69.8 µs |     64.9 µs |    1.1x |
|                                                 | match many_fast   |  69.2 µs |     66.0 µs |    1.0x |
|                                                 | match large       |  5.76 ms |     2.03 ms |    2.8x |
| linkify-it 5.0.2 → `tinylinkify`                | match chat        | 198.6 µs |     61.9 µs |    3.2x |
|                                                 | match large       |  5.99 ms |     2.17 ms |    2.8x |
| linkify-it 6.1.0 → `tinylinkify/gfm`            | test, match chat  |  75.9 µs |     63.8 µs |    1.2x |
|                                                 | test, match large |  1.52 ms |     1.99 ms |    0.8x |
| markdown-exit 1.3.0, linkify-it 5.0.2 → drop-in | render chat       | 343.1 µs |    246.8 µs |    1.4x |
| markdown-exit 1.3.0, linkify-it 5.0.2 → `/gfm`  | render chat       | 345.9 µs |    199.4 µs |    1.7x |
| markdown-exit 2.1.0, linkify-it 6.1.0 → `/gfm`  | render chat       | 230.2 µs |    197.6 µs |    1.2x |

`node bench/index.ts` prints every row, the root's and linkify-it 6's on each sample included.
