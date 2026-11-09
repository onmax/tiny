// What remark-gfm links, for the GFM comparisons.
// - `autolinks(text)`: the links remark-gfm's autolink literal step finds in
//   plain text: micromark with gfmAutolinkLiteral and every other construct
//   turned off, then mdast-util-gfm-autolink-literal, so the text is one run
//   as tinylinkify sees it. Offsets come from the text nodes around each link.
// - `remarkLinks(markdown)`: every link remark-parse with remark-gfm makes.
// - `exitLinks(markdown, LinkifyIt)`: every link markdown-exit makes with that
//   linkifier, and its URLs as remark's would read after markdown-exit's
//   normalizeLink.
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import MarkdownExit from "markdown-exit";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const OFF = [
  "attention",
  "autolink",
  "blockQuote",
  "characterEscape",
  "characterReference",
  "codeFenced",
  "codeIndented",
  "codeText",
  "definition",
  "hardBreakEscape",
  "headingAtx",
  "htmlFlow",
  "htmlText",
  "labelEnd",
  "labelStartImage",
  "labelStartLink",
  "list",
  "setextUnderline",
  "thematicBreak",
];

export interface Found {
  index: number;
  lastIndex: number;
  url: string;
}

type Node = { type: string; value?: string; url?: string; children?: Node[] };
const textOf = (node: Node): string =>
  node.value ?? (node.children ?? []).map(textOf).join("");

/**
 * The links in `text`, a single line with no whitespace at either end, as
 * remark-gfm's autolink literal step finds them. Throws when the paragraph
 * doesn't add up to the text, which means remark read it as more than text.
 */
export function autolinks(text: string): Found[] {
  const tree = fromMarkdown(text, {
    extensions: [gfmAutolinkLiteral(), { disable: { null: OFF } }],
    mdastExtensions: [gfmAutolinkLiteralFromMarkdown()],
  }) as unknown as Node;
  const children = tree.children?.[0]?.children ?? [];
  const found: Found[] = [];
  let offset = 0;
  for (const child of children) {
    const value = textOf(child);
    if (child.type === "link")
      found.push({ index: offset, lastIndex: offset + value.length, url: child.url! });
    offset += value.length;
  }
  const whole = children.map(textOf).join("");
  if (whole !== text) throw new Error(`remark read ${JSON.stringify(text)} as ${JSON.stringify(whole)}`);
  return found;
}

const remark = unified().use(remarkParse).use(remarkGfm);

export interface MarkdownLink {
  url: string;
  text: string;
}

/** Every link remark-gfm makes in `markdown`, in order. */
export function remarkLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const walk = (node: Node) => {
    if (node.type === "link") links.push({ url: node.url!, text: textOf(node) });
    node.children?.forEach(walk);
  };
  walk(remark.runSync(remark.parse(markdown)) as unknown as Node);
  return links;
}

type Token = { type: string; children: Token[] | null; content: string; attrGet(name: string): string | null };

/** markdown-exit with `linkify` on and the given linkifier. */
export function markdownExit(LinkifyIt: new () => unknown) {
  const md = MarkdownExit({ linkify: true }) as unknown as {
    linkify: unknown;
    parse(src: string, env: object): Token[];
    normalizeLink(url: string): string;
  };
  md.linkify = new LinkifyIt();
  return {
    /** Every link markdown-exit makes in `markdown`, in order. */
    links(markdown: string): MarkdownLink[] {
      const links: MarkdownLink[] = [];
      const walk = (tokens: Token[]) => {
        let open: MarkdownLink | undefined;
        for (const token of tokens) {
          if (token.type === "link_open") links.push((open = { url: token.attrGet("href")!, text: "" }));
          else if (token.type === "link_close") open = undefined;
          else if (open && (token.type === "text" || token.type === "code_inline" || token.type === "text_special"))
            open.text += token.content;
          if (token.children) walk(token.children);
        }
      };
      walk(md.parse(markdown, {}));
      return links;
    },
    normalizeLink: (url: string) => md.normalizeLink(url),
  };
}
