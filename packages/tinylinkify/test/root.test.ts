// The root, tinylinkify's own API: GFM autolink literals in plain text, as
// remark-gfm finds them. scripts/fuzz-gfm.ts checks it against remark-gfm on
// fuzzed text; these are the rules, one case each.
import { describe, expect, it } from "vite-plus/test";
import { find, test } from "../src/index.ts";

const urls = (text: string) => find(text).map((link) => link.url);
const texts = (text: string) => find(text).map((link) => link.text);

describe("find", () => {
  it("returns each link with its place, text, URL and schema", () => {
    expect(find("Visit www.commonmark.org/help for more.")).toEqual([
      {
        schema: "",
        index: 6,
        lastIndex: 29,
        text: "www.commonmark.org/help",
        url: "http://www.commonmark.org/help",
      },
    ]);
    expect(find("a https://example.com b")).toEqual([
      {
        schema: "https:",
        index: 2,
        lastIndex: 21,
        text: "https://example.com",
        url: "https://example.com",
      },
    ]);
    expect(find("mail foo@bar.baz")).toEqual([
      {
        schema: "mailto:",
        index: 5,
        lastIndex: 16,
        text: "foo@bar.baz",
        url: "mailto:foo@bar.baz",
      },
    ]);
    expect(find("no links here")).toEqual([]);
  });

  it("links www. and http(s):// URLs, and emails", () => {
    expect(urls("www.example.com http://example.com HTTPS://EXAMPLE.COM a@b.co")).toEqual([
      "http://www.example.com",
      "http://example.com",
      "HTTPS://EXAMPLE.COM",
      "mailto:a@b.co",
    ]);
  });

  it("leaves out trailing punctuation, unmatched closing parentheses and character references", () => {
    expect(texts("Visit www.commonmark.org.")).toEqual(["www.commonmark.org"]);
    expect(texts("see https://example.com/a?b=c!),")).toEqual(["https://example.com/a?b=c"]);
    expect(texts("www.google.com/search?q=Markup+(business)))")).toEqual([
      "www.google.com/search?q=Markup+(business)",
    ]);
    expect(texts("(www.google.com/search?q=Markup+(business))")).toEqual([
      "www.google.com/search?q=Markup+(business)",
    ]);
    expect(texts("www.google.com/search?q=commonmark&hl;")).toEqual([
      "www.google.com/search?q=commonmark",
    ]);
    expect(texts("www.commonmark.org/he<lp")).toEqual(["www.commonmark.org/he"]);
  });

  it("links a host with no dot after http(s)://, but not an underscore in its last two labels", () => {
    expect(urls("http://localhost:3000/x")).toEqual(["http://localhost:3000/x"]);
    expect(urls("www.a_b.com www.ab.c_d https://a_b.example.com/x")).toEqual([
      "https://a_b.example.com/x",
    ]);
  });

  it("needs whitespace or `(*_[]~` before www., and no letter before http", () => {
    expect(urls("x www.a.com (www.b.com ~www.c.com")).toEqual([
      "http://www.a.com",
      "http://www.b.com",
      "http://www.c.com",
    ]);
    expect(urls("1http://a.com xhttp://b.com")).toEqual(["http://a.com"]);
    // remark-gfm's second search links after any punctuation.
    expect(urls('"www.a.com"')).toEqual(["http://www.a.com"]);
  });

  it("takes emails as GFM does, so @mentions aren't links", () => {
    expect(urls("hey @alice and @bob.smith")).toEqual([]);
    expect(urls("hello@mail+xyz.example isn't valid, but hello+xyz@mail.example is.")).toEqual([
      "mailto:hello+xyz@mail.example",
    ]);
    expect(urls("a.b-c_d@a.b a.b-c_d@a.b. a.b-c_d@a.b- a.b-c_d@a.b_")).toEqual([
      "mailto:a.b-c_d@a.b",
      "mailto:a.b-c_d@a.b",
    ]);
  });

  it("finds what remark-gfm's parser skips with its second search", () => {
    // The parser skips an email after `/`; the search doesn't.
    expect(texts("/a@b.co")).toEqual(["a@b.co"]);
    // The parser reads the address after `mailto:` and leaves the prefix out.
    expect(find("mailto:foo@bar.com")).toMatchObject([
      { index: 7, text: "foo@bar.com", schema: "mailto:" },
    ]);
    // A domain the parser turns down, the search links, prefix and all.
    expect(find("mailto:foo@a.-b")).toMatchObject([
      { index: 0, text: "mailto:foo@a.-b", url: "mailto:foo@a.-b" },
    ]);
    expect(find("xmpp:foo@a.-b/txt")).toMatchObject([
      { text: "xmpp:foo@a.-b/txt", schema: "xmpp:" },
    ]);
  });

  it("reads UTF-16 code units, as micromark does", () => {
    expect(urls("www.點看.com https://例え.テスト/パス")).toEqual([
      "http://www.點看.com",
      "https://例え.テスト/パス",
    ]);
    expect(texts("www.a.com/😀!")).toEqual(["www.a.com/😀"]);
  });

  it("runs in linear time on long runs of trailing punctuation", () => {
    const start = performance.now();
    find(`www.a.com/${".".repeat(200_000)}x ${"(".repeat(100_000)}`);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("test", () => {
  it("says whether there's a link", () => {
    expect(test("see www.example.com")).toBe(true);
    expect(test("@alice see you at 10")).toBe(false);
  });
});
