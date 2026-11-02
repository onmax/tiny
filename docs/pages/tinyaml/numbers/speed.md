---
title: Speed
description: Parse and stringify timings of each tinyaml entry against the library it replaces.
---

![Times faster than the original, 268 KiB file](/charts/speed.svg)

Median time per call over 7 rounds, from [`bench/index.ts`](https://github.com/onmax/tiny/blob/main/packages/tinyaml/bench/index.ts), on an Apple M4 with Node 26.13. The libraries are js-yaml 4.3.2, js-yaml 5.5.0, yaml 2.9.1, yamljs 0.3.0 and @std/yaml 1.3.0. Each runs with default options, as does the tinyaml entry that replaces it. The inputs are a 7-line frontmatter block and js-yaml's `package-lock.json` written as YAML, 268 KiB. The last four rows compare tinyaml's root API with yaml 2.9.1, the library closest to its rules. yaml's `parse` builds a Document, with its nodes, comments and source ranges, and then converts it to plain values, where tinyaml builds the values directly.

## All timings

| Library      | Operation             |  Library | tinyaml | Speedup |
| ------------ | --------------------- | -------: | ------: | ------: |
| js-yaml 4    | parse frontmatter     |   2.7 µs |  1.7 µs |    1.6x |
| js-yaml 4    | stringify frontmatter |   3.7 µs |  2.5 µs |    1.5x |
| js-yaml 4    | parse 268 KiB         |  3.00 ms | 2.00 ms |    1.5x |
| js-yaml 4    | stringify 268 KiB     |  4.51 ms | 2.77 ms |    1.6x |
| js-yaml 5    | parse frontmatter     |   3.1 µs |  1.7 µs |    1.8x |
| js-yaml 5    | stringify frontmatter |   5.3 µs |  2.7 µs |    2.0x |
| js-yaml 5    | parse 268 KiB         |  3.07 ms | 2.00 ms |    1.5x |
| js-yaml 5    | stringify 268 KiB     |  5.22 ms | 2.90 ms |    1.8x |
| yaml 2       | parse frontmatter     |  29.6 µs |  2.8 µs |   10.6x |
| yaml 2       | stringify frontmatter |  13.7 µs |  4.2 µs |    3.3x |
| yaml 2       | parse 268 KiB         | 35.89 ms | 2.85 ms |   12.6x |
| yaml 2       | stringify 268 KiB     | 11.93 ms | 4.22 ms |    2.8x |
| yamljs       | parse frontmatter     |   7.1 µs |  2.0 µs |    3.5x |
| yamljs       | stringify frontmatter |   1.6 µs |  1.1 µs |    1.4x |
| yamljs       | parse 268 KiB         | 11.36 ms | 2.29 ms |    5.0x |
| yamljs       | stringify 268 KiB     |  1.46 ms | 1.28 ms |    1.1x |
| @std/yaml    | parse frontmatter     |   3.7 µs |  1.7 µs |    2.1x |
| @std/yaml    | stringify frontmatter |   3.8 µs |  2.3 µs |    1.7x |
| @std/yaml    | parse 268 KiB         |  4.03 ms | 2.03 ms |    2.0x |
| @std/yaml    | stringify 268 KiB     |  4.10 ms | 2.56 ms |    1.6x |
| yaml 2, root | parse frontmatter     |  30.4 µs |  1.6 µs |   19.4x |
| yaml 2, root | stringify frontmatter |  14.1 µs |  1.1 µs |   13.2x |
| yaml 2, root | parse 268 KiB         | 36.22 ms | 1.87 ms |   19.3x |
| yaml 2, root | stringify 268 KiB     | 12.65 ms | 1.01 ms |   12.5x |

tinyaml is faster on every row. The closest is tinyaml/yamljs's `stringify` on the 268 KiB file, 1.28 ms to yamljs's 1.46 ms. It has to write the same bytes as yamljs, so it follows yamljs's dumper closely.

## yaml 3

yaml 3.0.0-2, a prerelease published as `yaml@next`, parses 3 to 4 times faster than yaml 2.9.1 in this benchmark and stringifies 1.3 to 1.4 times faster. These timings come from another machine than the table above, an AMD Ryzen 7 255 shared with other jobs, with Node 24.21, so the two tables don't mix. yaml 2.9.1 was timed in the same runs as yaml 3. Each time is the median of 10, from 5 runs of `bench/index.ts`.

| Operation             | yaml 2.9.1 | yaml 3.0.0-2 | tinyaml/yaml | tinyaml |
| --------------------- | ---------: | -----------: | -----------: | ------: |
| parse frontmatter     |    59.7 µs |      19.3 µs |       7.1 µs |  3.7 µs |
| stringify frontmatter |    30.2 µs |      22.3 µs |       8.8 µs |  2.0 µs |
| parse 268 KiB         |    70.5 ms |      19.1 ms |       6.6 ms |  4.4 ms |
| stringify 268 KiB     |    29.2 ms |      23.1 ms |      10.2 ms |  1.7 ms |

Against yaml 3.0.0-2, tinyaml/yaml parses 2.7 to 2.9 times faster and stringifies 2.3 to 2.5 times faster. tinyaml's root API parses 4.4 to 5.2 times faster and stringifies 11 to 13.5 times faster. tinyaml/yaml follows yaml 2, and isn't checked against yaml 3's API or tests, so this compares speed only.
