---
title: Get started
description: Install tinylinkify and find GFM links in plain text with its own API, give markdown-it GFM links, or switch from linkify-it with one import.
---

```sh
pnpm add tinylinkify
```

npm holds no package under this name until the first release. Until then, clone this repository and run `pnpm install` and `pnpm build` to get the package in `dist/`.

```ts
import { find, test } from "tinylinkify";

find("see www.example.com, or mail a.b@example.com. cc @alice");
// [
//   { schema: "", index: 4, lastIndex: 19, text: "www.example.com", url: "http://www.example.com" },
//   { schema: "mailto:", index: 29, lastIndex: 44, text: "a.b@example.com", url: "mailto:a.b@example.com" },
// ]
test("@alice see you at 10."); // false
```

`find(text)` returns every link in `text`, in order, and `test(text)` whether there is one. A link has the `index` it starts at and the `lastIndex` it ends at, its `text` as written, the `url` it points to, and a `schema`: `""` for a `www.` link, `http:` or `https:`, `mailto:` for an email, or `xmpp:`.

The rules are GitHub's [autolink literals](https://github.github.com/gfm/#autolinks-extension-), as remark-gfm applies them, on text with no other markdown in it:

- `www.` links start at the beginning or after whitespace, `(`, `*`, `_`, `[`, `]` or `~`, and `http://` and `https://` links anywhere but after a letter. A `www.` host needs a dot, and neither host may have an underscore in its last two labels.
- Trailing `?`, `!`, `.`, `,`, `:`, `*`, `_`, `~`, quotes and a character reference such as `&hl;` aren't part of the link, nor is a closing parenthesis it didn't open. `<` ends it.
- An email is letters, digits, `.`, `-`, `_` and `+`, an `@`, then a domain with a dot that ends in a letter. It can't follow a letter, digit, those characters or `/`, so `@mentions` aren't links.
- remark-gfm then searches the text between those links once more, by its own rules, which also link after any punctuation, and `mailto:` and `xmpp:` addresses with a domain the first rules turn down. tinylinkify does both.

Characters are UTF-16 code units, as micromark reads them, so a host can be `例え.テスト` and an emoji doesn't end a path. There are no options: tinylinkify finds what remark-gfm finds.

Already on linkify-it? It has a drop-in subpath: see [Compatibility](/tinylinkify/compatibility/).

## GFM links in markdown-it and markdown-exit

markdown-it and markdown-exit find links with linkify-it, which doesn't link `www.example.com` and links fuzzy domains and emails remark-gfm doesn't. `tinylinkify/gfm` is the root's rules behind the methods they call, so their `linkify` option links what GitHub does:

```ts
import MarkdownExit from "markdown-exit";
import LinkifyIt from "tinylinkify/gfm";

const md = MarkdownExit({ linkify: true });
md.linkify = new LinkifyIt();
md.render("see www.example.com, thanks @alice");
// '<p>see <a href="http://www.example.com">www.example.com</a>, thanks @alice</p>\n'
```

It isn't a drop-in for linkify-it, since the links differ. It has `test`, `pretest`, `match` and `matchAtStart`, whose matches have linkify-it's fields, and `set`, which reads `fuzzyLink` (`www.` links) and `fuzzyEmail` (emails without `mailto:`). `tlds` and `add` take their arguments and do nothing, since GFM has no TLD list or custom schemas, and `fuzzyIP` is ignored: GFM links an IP address only after `http://` or `https://`. `pretest` is a quick check that never says no to text with a link: `www.`, `://`, or an address character before an `@`, so chat full of `@mentions` skips `match`.

markdown-exit with it links the same as remark-gfm on 98 of 98 chat messages, where linkify-it gets 83 (URLs compared after decoding). The parsers still differ around the linkifier, and tinylinkify/gfm can't change that from inside linkify-it's interface:

- **After an unclosed `[`.** remark-gfm's parser reads no autolink literal after a `[` that hasn't closed yet, and its second search links them by its own rules: it keeps `*`, `_`, `~` and `<` in the link and leaves out `>`, `}` and `&`, needs a dot in the host, and links `mailto:foo@bar.com` with its prefix. markdown-exit asks the linkifier from inside its parser, where the `[` doesn't show, so `[www.commonmark.org/he<lp` links `www.commonmark.org/he<lp` in remark-gfm and `www.commonmark.org/he` in markdown-exit.
- **Character references and escapes.** markdown-exit gives the linkifier the text between them, and links nothing that starts right after one, so `www.a.com&copy;b` links `www.a.com` where remark-gfm links `www.a.com©b`, and `\+a@b.c` links nothing where remark-gfm links `+a@b.c`.
- **Code spans and other inline markup.** markdown-exit parses them before it links `www.` links and emails, and remark-gfm after, so ``www.a.com`]` `` links `www.a.com` in markdown-exit and all of it in remark-gfm. markdown-exit links `http(s)://` first, as remark-gfm does.
- **URLs.** markdown-exit percent-encodes the `href` and writes hosts in punycode, so `https://例え.テスト` points to `https://xn--r8jz45g.xn--zckzah`.

Coming from remark-gfm on its own, the root differs in two places: tinylinkify reads U+0000 as itself, where micromark reads it as U+FFFD, and it doesn't link `ftp://`, which remark-gfm doesn't either, though the GFM spec 0.29 does.
