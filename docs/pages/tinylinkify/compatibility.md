---
title: Compatibility with linkify-it
label: Compatibility
description: The subpath that replaces linkify-it 4 and 5, how it was checked, and every place it still differs.
---

`tinylinkify/linkify-it` exports linkify-it's constructor, so switching is a change to the import line. It has linkify-it's instance properties, `re` sources, schemas, options, validators and error messages; the last column is linkify-it's own test suite, run with tinylinkify in its place.

`npx tinyswap` makes this change for you: it rewrites the imports and swaps the dependency in package.json.

| Library                 | Change the import to       | Size, gzip      | Its own tests on tinylinkify |
| ----------------------- | -------------------------- | --------------- | ---------------------------- |
| linkify-it 4.0.1, 5.x   | `"tinylinkify/linkify-it"` | 4.11 → 3.77 KiB | 176 of 176 pass              |

```ts
// before
import LinkifyIt from "linkify-it";
const LinkifyIt = require("linkify-it");
// after
import LinkifyIt from "tinylinkify/linkify-it";
const LinkifyIt = require("tinylinkify/linkify-it");
```

It follows linkify-it 5.0.2. [`scripts/versions.ts`](https://github.com/onmax/tiny/blob/main/packages/tinylinkify/scripts/versions.ts) fuzzes linkify-it 3.0.3, 4.0.1, 5.0.0, 5.0.1 and 5.0.2, each against the next: 3.0.3 has no `matchAtStart`, 4.0.1 and 5.0.0 behave the same, 5.0.1 changed how they search, and 5.0.1 and 5.0.2 behave the same. linkify-it 6 is another API, a class with no `pretest` and fuzzy links off by default, and markdown-it 15 and markdown-exit 2 use it; this entry doesn't cover it.

## linkify-it 5: what's different

- Unicode punctuation. linkify-it reads it from uc.micro 2.1.0, which has Unicode 15.1; tinylinkify reads the engine's `\p{P}`. On Node 24, which has Unicode 17, 14 more code points are punctuation, so a fuzzy link ends at them where linkify-it reads them as letters: U+1B4E, U+1B4F, U+1B7F, U+10D6E, U+10ED0, U+113D4, U+113D5, U+113D7, U+113D8, U+11BE1, U+16D6D to U+16D6F and U+1E5FF. On another engine, the set is that engine's.
- `re.src_P` holds the same class as uc.micro's `P` for that Unicode version, written with the characters themselves rather than escapes, so the patterns built from it stay well under the 20,480 characters above which V8 stops optimizing a regular expression. linkify-it's fuzzy link pattern is 19,243 characters; tinylinkify's is 11,731. Every other `re` source is linkify-it's, character for character, and they work without the `u` flag as linkify-it's do.
- Start-up. tinylinkify builds that class the first time you construct a linkifier, once per process. On the machine below, importing, constructing and matching once takes 14.2 ms, against 12.4 ms for linkify-it.
- Packaging. ESM only, with a `"module.exports"` export, so `require("tinylinkify/linkify-it")` returns the constructor on Node 22.12 and later, as `require("linkify-it")` does. linkify-it's other files, such as `linkify-it/lib/re.mjs`, have no equivalent, and tinyswap leaves imports of them alone. The types are the signatures of `@types/linkify-it` 5.0.0.
- linkify-it 4.0.1 and 5.0.0. Since 5.0.1, linkify-it searches each pattern on from where its last match ended, so in `<a@b.co:c@d.com>` it finds `a@b.co` and no longer `:c@d.com` too, and since 5.0.2 an email name after `mailto:` is at most 64 characters. linkify-it 4 reads punctuation from uc.micro 1.0.6, which has Unicode 11, 56 code points fewer than 2.1.0.

`match` gets there faster without changing what it finds. It skips the fuzzy link search when the text has no `.` followed by a TLD, which every fuzzy link has; starts the fuzzy email search at most 65 characters before the first `@` that follows a character an email name can end in, since a name is at most 64; and runs each built-in schema's pattern once where linkify-it runs it twice. Each shortcut holds only for the patterns tinylinkify built: one you replace in `re`, or change in `onCompile`, gets linkify-it's way.


## How it's checked

The drop-in is checked against linkify-it 5.0.2, and the GFM entries against remark-gfm, each installed next to it as a development dependency:

- linkify-it 5.0.2's own tests, copied unchanged into [`test/suites`](https://github.com/onmax/tiny/tree/main/packages/tinylinkify/test/suites) and run with tinylinkify in its place: 172 fixture and API tests, 3 pathological inputs that must not hang, and the CommonJS `require()` test, 176 of 176, as linkify-it passes them.
- 200,000 fuzzed inputs, made by editing linkify-it's fixtures, its benchmark samples and chat with the pieces its patterns care about, through `pretest`, `test`, `match`, `matchAtStart` and `testSchemaAt` on 14 setups: each option, `---`, replaced and added TLDs, added, aliased and disabled schemas, a replaced normalizer and an `onCompile` that changes a template. Arguments of the wrong type, bad schema definitions and odd options are compared too, errors by class and message, and every `re` source after construction. The reference that must match on every input is linkify-it with uc.micro's punctuation swapped for the engine's, built one code point at a time apart from tinylinkify's code: 6,001,500 calls, 0 differences. Against linkify-it as published, the inputs that differ are those with one of the 14 code points above, about 2.4% of them, since the fuzzer adds them on purpose.
- The GFM entries against remark-gfm's autolink step on plain text: micromark with the autolink literal extension and every other construct turned off, then mdast-util-gfm-autolink-literal, so the text is one run as tinylinkify sees it. 70,000 fuzzed lines from the micromark and mdast fixtures, the benchmark samples and chat, with 45,000 links: 0 differences in offsets or URLs, for the root, for `tinylinkify/gfm`'s `match`, and for its `matchAtStart` on each `http(s)://` link.
- The GFM spec 0.29's 11 autolink examples and the fixtures of micromark-extension-gfm-autolink-literal (22) and mdast-util-gfm-autolink-literal (30), whose HTML is what github.com renders, through markdown-exit with tinylinkify/gfm, link for link: it matches remark-gfm on 11, 14 and 15 of them, and GitHub on 10, 3 and 15, where linkify-it matches GitHub on 6, 0 and 1. The fixtures it doesn't match are the markdown cases listed above, mostly `[` before every line; the spec example is `ftp://`.
- Every fuzzer and suite runner exits with an error on a difference or a failed test, and when a suite runs no tests.
