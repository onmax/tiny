// tinylinkify/gfm: GFM links behind the part of linkify-it's interface that
// markdown-it and markdown-exit call.
import { readFileSync } from "node:fs";
import MarkdownExit from "markdown-exit";
import { describe, expect, it } from "vite-plus/test";
import LinkifyIt from "../src/gfm/index.ts";
import { benchSamples } from "../scripts/shared.ts";

describe("tinylinkify/gfm", () => {
  it("works with and without new", () => {
    expect(new LinkifyIt().test("www.a.com")).toBe(true);
    expect(LinkifyIt().test("www.a.com")).toBe(true);
  });

  it("returns linkify-it's match fields, in its order, or null", () => {
    const [m] = new LinkifyIt().match("see www.example.com.")!;
    expect(Object.entries(m!)).toEqual([
      ["schema", ""],
      ["index", 4],
      ["lastIndex", 19],
      ["raw", "www.example.com"],
      ["text", "www.example.com"],
      ["url", "http://www.example.com"],
    ]);
    expect(new LinkifyIt().match("@alice see you")).toBeNull();
  });

  it("never fails pretest on text with a link", () => {
    const linkify = new LinkifyIt();
    const lines = [
      ...Object.values(benchSamples()).flatMap((text) => text.split("\n")),
      ...readFileSync(
        "test/suites/mdast-util-gfm-autolink-literal-2.1.0/fixture/base.md",
        "utf8",
      ).split("\n"),
    ];
    for (const line of lines) if (linkify.match(line)) expect(linkify.pretest(line)).toBe(true);
    expect(linkify.pretest("hey @alice, see you at 10.")).toBe(false);
  });

  it("reads fuzzyLink and fuzzyEmail, from set or the constructor", () => {
    const text = "www.a.com b@c.de mailto:e@f.gh https://i.jk";
    const urls = (l: InstanceType<typeof LinkifyIt>) => l.match(text)?.map((m) => m.url);
    expect(urls(new LinkifyIt())).toEqual([
      "http://www.a.com",
      "mailto:b@c.de",
      "mailto:e@f.gh",
      "https://i.jk",
    ]);
    expect(urls(new LinkifyIt().set({ fuzzyLink: false }))).toEqual([
      "mailto:b@c.de",
      "mailto:e@f.gh",
      "https://i.jk",
    ]);
    // Without bare emails, a `mailto:` address is still a link, prefix and all.
    expect(urls(new LinkifyIt({ fuzzyEmail: false }))).toEqual([
      "http://www.a.com",
      "mailto:e@f.gh",
      "https://i.jk",
    ]);
    expect(new LinkifyIt({}, { fuzzyEmail: false }).match(text)?.[1]?.text).toBe("mailto:e@f.gh");
  });

  it("matches a http(s):// link at the start only", () => {
    const linkify = new LinkifyIt();
    expect(linkify.matchAtStart("https://a.com/b_c_ and more")).toEqual({
      schema: "https:",
      index: 0,
      lastIndex: 17,
      raw: "https://a.com/b_c",
      text: "https://a.com/b_c",
      url: "https://a.com/b_c",
    });
    expect(linkify.matchAtStart("www.a.com")).toBeNull();
    expect(linkify.matchAtStart(" https://a.com")).toBeNull();
    expect(linkify.matchAtStart("https://")).toBeNull();
  });

  it("takes tlds and add, and does nothing with them", () => {
    const linkify = new LinkifyIt();
    expect(linkify.tlds(["onion"]).add("git:", "http:")).toBe(linkify);
    expect(linkify.test("a.onion git://a.com")).toBe(false);
  });

  it("is markdown-exit's linkifier", () => {
    const md = MarkdownExit({ linkify: true }) as unknown as {
      linkify: unknown;
      render(src: string): string;
    };
    md.linkify = new LinkifyIt();
    expect(md.render("see www.example.com, thanks @alice")).toBe(
      '<p>see <a href="http://www.example.com">www.example.com</a>, thanks @alice</p>\n',
    );
    expect(md.render("https://a.com/foo_bar_baz and _em_")).toBe(
      '<p><a href="https://a.com/foo_bar_baz">https://a.com/foo_bar_baz</a> and <em>em</em></p>\n',
    );
    expect(md.render("mail a.b@example.com.")).toBe(
      '<p>mail <a href="mailto:a.b@example.com">a.b@example.com</a>.</p>\n',
    );
  });
});
