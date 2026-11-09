---
title: Size and speed
description: Bundle size and timings of each entry next to linkify-it.
---

Each entry as npm ships it in `dist/`, bundled with esbuild, minified ESM, then gzip -9, from [`scripts/size.ts`](https://github.com/onmax/tiny/blob/main/packages/tinylinkify/scripts/size.ts). An entry counts its named exports and its default export. A KiB is 1,024 bytes. Measured on Linux with Node 24.21.0.

| Entry                    | Minified  | Gzip     |
| ------------------------ | --------- | -------- |
| `tinylinkify`            | 3.37 KiB  | 1.71 KiB |
| `tinylinkify/gfm`        | 4.14 KiB  | 2.02 KiB |
| `tinylinkify/linkify-it` | 9.94 KiB  | 3.77 KiB |
| linkify-it 5.0.2         | 11.25 KiB | 4.11 KiB |

Most of linkify-it is its patterns, which the drop-in keeps, so it saves what uc.micro's punctuation table weighed, less the code that builds the class and the shortcuts. The GFM entries share one search; `tinylinkify/gfm` adds the interface around it. `scripts/size.ts` fails if an entry outgrows its budget or linkify-it, if one entry bundles another's code, if a package specifier such as `tinylinkify/gfm` loads the wrong entry, or if the root stops being the smallest.

## Speed

Median time per call over seven rounds, from [`bench/index.ts`](https://github.com/onmax/tiny/blob/main/packages/tinylinkify/bench/index.ts), on the built `dist/` (AMD Ryzen 7 255, Node 24.21.0, on a machine other jobs share). The two sides' rounds interleave, and which runs first alternates. The inputs are linkify-it's five benchmark samples, 52 chat messages full of `@mentions`, and about 100 KB of all of them; the call is the one markdown-it makes, `match` after a `pretest` that passes. The GFM entries find GFM's links, not linkify-it's, so theirs is the same work on the same text, not the same result. The last rows are markdown-exit rendering the chat messages with each linkifier.

| Library                                       | Operation         | Library | tinylinkify | Speedup |
| --------------------------------------------- | ----------------- | ------: | ----------: | ------: |
| linkify-it 5.0.2 → `tinylinkify/linkify-it`   | match chat        | 200.9 µs |   158.4 µs |    1.3x |
|                                               | match email_fuzzy |  82.5 µs |    68.0 µs |    1.2x |
|                                               | match link_fuzzy  |  88.8 µs |    70.1 µs |    1.3x |
|                                               | match link_normal |  97.7 µs |    85.8 µs |    1.1x |
|                                               | match many        |  73.0 µs |    64.2 µs |    1.1x |
|                                               | match many_fast   |  72.7 µs |    63.7 µs |    1.1x |
|                                               | match large       |  6.30 ms |    5.69 ms |    1.1x |
| linkify-it 5.0.2 → `tinylinkify/gfm`          | match chat        | 217.1 µs |    64.8 µs |    3.3x |
|                                               | match email_fuzzy |  84.1 µs |    62.9 µs |    1.3x |
|                                               | match link_fuzzy  |  88.1 µs |    70.7 µs |    1.2x |
|                                               | match link_normal | 101.1 µs |    46.6 µs |    2.2x |
|                                               | match many        |  74.6 µs |    70.1 µs |    1.1x |
|                                               | match many_fast   |  74.3 µs |    73.0 µs |    1.0x |
|                                               | match large       |  6.33 ms |    2.25 ms |    2.8x |
| linkify-it 5.0.2 → `tinylinkify`              | match chat        | 226.9 µs |    72.3 µs |    3.1x |
|                                               | match large       |  5.84 ms |    2.12 ms |    2.8x |
| markdown-exit 1.3.0, linkify-it → drop-in     | render chat       | 392.5 µs |   281.0 µs |    1.4x |
| markdown-exit 1.3.0, linkify-it → `/gfm`      | render chat       | 359.7 µs |   239.3 µs |    1.5x |

`node bench/index.ts` prints every row, the root's on each sample included.
