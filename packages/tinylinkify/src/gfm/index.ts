// GFM autolink literals behind linkify-it's interface, for markdown-it and
// markdown-exit: `md.linkify = new LinkifyIt()` from here makes their
// `linkify` option link what remark-gfm and GitHub link, `www.` links
// included. It isn't a drop-in for linkify-it: the links differ, there are no
// TLD lists or custom schemas, and `tlds` and `add` do nothing.
import { find, findAtStart, type Link } from "../core/gfm.ts";

export interface Options {
  /** Link `www.` URLs. Default `true`. */
  fuzzyLink?: boolean | undefined;
  /** Link emails without `mailto:`. Default `true`. */
  fuzzyEmail?: boolean | undefined;
  /** Ignored: GFM links an IP address only after `http://` or `https://`. */
  fuzzyIP?: boolean | undefined;
}

/** A link, with linkify-it's fields. */
export interface Match extends Link {
  /** The link as written, the same as `text`. */
  raw: string;
}

// What every link has: `www.`, `://`, or an address character before an `@`.
const PRETEST = /www\.|:\/\/|[\w+.-]@/i;

const toMatch = ({ schema, index, lastIndex, text, url }: Link): Match => ({
  schema,
  index,
  lastIndex,
  raw: text,
  text,
  url,
});

interface LinkifyIt {
  /** Options for links without a schema; see Options. */
  set(options: Options): this;
  /** Whether the text has a link. */
  test(text: string): boolean;
  /** A quick check: `false` means the text has no link. */
  pretest(text: string): boolean;
  /** Every link in the text, or `null` when there's none. */
  match(text: string): Match[] | null;
  /** The `http://` or `https://` link at the start of the text, or `null`. */
  matchAtStart(text: string): Match | null;
  /** Does nothing: GFM has no TLD list. */
  tlds(list: string | string[], keepOld?: boolean): this;
  /** Does nothing: GFM has no custom schemas. */
  add(schema: string, definition: unknown): this;
}

interface LinkifyItConstructor {
  /** Takes linkify-it's arguments, `(options)` or `(schemas, options)`, and reads only the options. Works without `new` too. */
  new (schemas?: object, options?: Options): LinkifyIt;
  (schemas?: object, options?: Options): LinkifyIt;
  prototype: LinkifyIt;
}

const LinkifyIt = function LinkifyIt(this: any, schemas?: any, options?: Options) {
  if (!(this instanceof LinkifyIt)) return new LinkifyIt(schemas, options);
  this.__opts__ = { fuzzyLink: true, fuzzyEmail: true, fuzzyIP: false };
  this.set(options || schemas || {});
} as unknown as LinkifyItConstructor;

const proto: any = LinkifyIt.prototype;
proto.set = function set(options: Options) {
  for (const key of ["fuzzyLink", "fuzzyEmail", "fuzzyIP"] as const)
    if (options?.[key] !== undefined) this.__opts__[key] = options[key];
  return this;
};
proto.pretest = (text: string) => PRETEST.test(text);
proto.match = function match(text: string) {
  const links = find(text, !!this.__opts__.fuzzyLink, !!this.__opts__.fuzzyEmail);
  return links.length ? links.map(toMatch) : null;
};
proto.test = function test(text: string) {
  return this.match(text) !== null;
};
proto.matchAtStart = (text: string) => {
  const link = findAtStart(text);
  return link ? toMatch(link) : null;
};
proto.tlds = proto.add = function (this: LinkifyIt) {
  return this;
};

export default LinkifyIt;
