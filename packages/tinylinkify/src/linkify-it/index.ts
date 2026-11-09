// A drop-in replacement for linkify-it 5.0.2: `import LinkifyIt from
// "tinylinkify/linkify-it"` works as `import LinkifyIt from "linkify-it"` does,
// with the same instance properties, `re` sources, validators and errors. It
// follows linkify-it's code closely, and the README lists where it differs:
// the Unicode punctuation class comes from the engine, and `match` skips the
// fuzzy scans that can't match.
import reFactory from "./re.ts";

export type Validate = (text: string, pos: number, self: LinkifyIt) => number | boolean;

export interface FullRule {
  validate: string | RegExp | Validate;
  normalize?: ((match: Match) => void) | undefined;
}

export type Rule = string | FullRule;

export interface SchemaRules {
  [schema: string]: Rule;
}

export interface Options {
  /** Recognize URLs without `http(s):` prefix. Default `true`. */
  fuzzyLink?: boolean | undefined;
  /** Allow IPs in fuzzy links. Can conflict with some texts like version numbers. Default `false`. */
  fuzzyIP?: boolean | undefined;
  /** Recognize emails without `mailto:` prefix. Default `true`. */
  fuzzyEmail?: boolean | undefined;
}

const toString = Object.prototype.toString;
const isString = (obj: unknown) => toString.call(obj) === "[object String]";
const isObject = (obj: unknown) => toString.call(obj) === "[object Object]";
const isRegExp = (obj: unknown) => toString.call(obj) === "[object RegExp]";
const isFunction = (obj: unknown) => toString.call(obj) === "[object Function]";

function assign(obj: any, ...sources: any[]) {
  sources.forEach((source) => {
    if (!source) return;
    Object.keys(source).forEach((key) => {
      obj[key] = source[key];
    });
  });
  return obj;
}

const escapeRE = (str: string) => str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");

const defaultOptions = { fuzzyLink: true, fuzzyEmail: true, fuzzyIP: false };

const isOptionsObj = (obj: any) =>
  Object.keys(obj || {}).reduce(
    // oxlint-disable-next-line no-prototype-builtins
    (acc: boolean, k) => acc || defaultOptions.hasOwnProperty(k),
    false,
  );

// A validator that compiles its regular expression on first use, from the
// instance's `re`, since the host parts change with the TLDs.
const lazy =
  (name: string, source: (re: Record<string, any>) => string, check?: (text: string, pos: number) => boolean) =>
  (text: string, pos: number, self: any) => {
    const tail = text.slice(pos);
    if (!self.re[name]) self.re[name] = new RegExp(source(self.re), "i");
    if (self.re[name].test(tail)) {
      if (check && !check(text, pos)) return 0;
      return tail.match(self.re[name])[0].length;
    }
    return 0;
  };

const defaultSchemas: Record<string, any> = {
  "http:": {
    validate: lazy("http", (re) => `^\\/\\/${re.src_auth}${re.src_host_port_strict}${re.src_path}`),
  },
  "https:": "http:",
  "ftp:": "http:",
  "//": {
    validate: lazy(
      "no_http",
      (re) =>
        "^" +
        re.src_auth +
        // No single-level domains, because of false positives like `//test` in code comments.
        `(?:localhost|(?:(?:${re.src_domain})\\.)+${re.src_domain_root})` +
        re.src_port +
        re.src_host_terminator +
        re.src_path,
      // Not `://` or `///`, which protects from errors in the protocol name.
      (text, pos) => !(pos >= 3 && (text[pos - 3] === ":" || text[pos - 3] === "/")),
    ),
  },
  "mailto:": {
    validate: lazy("mailto", (re) => `^${re.src_email_name}@${re.src_host_strict}`),
  },
};

// Two-letter TLDs, as linkify-it's support/tlds_2char_gen.js writes them.
const tlds_2ch_src_re =
  "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";

const tlds_default =
  "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф".split("|");

function createValidator(re: RegExp) {
  return (text: string, pos: number) => {
    const tail = text.slice(pos);
    if (re.test(tail)) return tail.match(re)![0].length;
    return 0;
  };
}

function createNormalizer() {
  return (match: Match, self: LinkifyIt) => {
    self.normalize(match);
  };
}

// What `match` may skip, for the `re` an instance compiled: the regular
// expressions it built from the unchanged templates, and a quick test that
// any fuzzy link needs to pass. A `re` that was replaced, or whose fuzzy
// regular expressions were, gets no shortcuts.
interface Shortcuts {
  link: RegExp;
  email: RegExp;
  tld?: RegExp;
}
const shortcuts = new WeakMap<object, Shortcuts>();

function compile(self: any) {
  const re = (self.re = reFactory(self.__opts__));
  const tlds = self.__tlds__.slice();
  const { tpl_link_no_ip_fuzzy, tpl_email_fuzzy } = re;

  self.onCompile();

  if (!self.__tlds_replaced__) tlds.push(tlds_2ch_src_re);
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join("|");

  const untpl = (tpl: string) => tpl.replace("%TLDS%", re.src_tlds);

  re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), "i");
  re.email_fuzzy_global = RegExp(untpl(re.tpl_email_fuzzy), "ig");
  re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), "i");
  re.link_fuzzy_global = RegExp(untpl(re.tpl_link_fuzzy), "ig");
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "i");
  re.link_no_ip_fuzzy_global = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "ig");
  re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), "i");

  const aliases: string[] = [];

  self.__compiled__ = {};

  const schemaError = (name: string, val: unknown) => {
    throw new Error(`(LinkifyIt) Invalid schema "${name}": ${val}`);
  };

  Object.keys(self.__schemas__).forEach((name) => {
    const val = self.__schemas__[name];

    // A disabled schema.
    if (val === null) return;

    const compiled: any = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) compiled.validate = createValidator(val.validate);
      else if (isFunction(val.validate)) compiled.validate = val.validate;
      else schemaError(name, val);

      if (isFunction(val.normalize)) compiled.normalize = val.normalize;
      else if (!val.normalize) compiled.normalize = createNormalizer();
      else schemaError(name, val);

      return;
    }

    if (isString(val)) {
      aliases.push(name);
      return;
    }

    schemaError(name, val);
  });

  // Aliases, once their targets are compiled. A missing target is skipped
  // silently, so disabling a schema doesn't break its aliases.
  aliases.forEach((alias) => {
    if (!self.__compiled__[self.__schemas__[alias]]) return;
    self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
  });

  // The record for links found without a schema.
  self.__compiled__[""] = { validate: null, normalize: createNormalizer() };

  const slist = Object.keys(self.__compiled__)
    .filter((name) => name.length > 0 && self.__compiled__[name])
    .map(escapeRE)
    .join("|");
  self.re.schema_test = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "i");
  self.re.schema_search = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "ig");
  self.re.schema_at_start = RegExp(`^${self.re.schema_search.source}`, "i");

  self.re.pretest = RegExp(
    `(${self.re.schema_test.source})|(${self.re.host_fuzzy_test.source})|@`,
    "i",
  );

  // A fuzzy link has a dot and then one of the TLDs, so text without one has
  // none. That holds while the template is the default, and while the TLDs
  // are plain enough to mean the same in a pattern of their own: no `$`,
  // which `String#replace` expands, and no back references.
  const tld =
    re.tpl_link_no_ip_fuzzy === tpl_link_no_ip_fuzzy && !/\$|\\[1-9k]/.test(re.src_tlds)
      ? RegExp(`\\.(?:${re.src_tlds})`, "i")
      : undefined;
  shortcuts.set(re, {
    link: re.link_no_ip_fuzzy_global,
    email: re.tpl_email_fuzzy === tpl_email_fuzzy ? re.email_fuzzy_global : /(?:)/,
    tld,
  });
}

/** A link `match` found. */
class Match {
  /** Prefix (protocol) for matched string. */
  schema: string;
  /** First position of matched string. */
  index: number;
  /** Next position after matched string. */
  lastIndex: number;
  /** Matched string. */
  raw: string;
  /** Normalized text of matched string. */
  text: string;
  /** Normalized url of matched string. */
  url: string;

  constructor(text: string, schema: string, index: number, lastIndex: number) {
    const raw = text.slice(index, lastIndex);
    this.schema = schema.toLowerCase();
    this.index = index;
    this.lastIndex = lastIndex;
    this.raw = raw;
    this.text = raw;
    this.url = raw;
  }
}

export type { Match };

interface Candidate {
  schema: string;
  index: number;
  lastIndex: number;
}

function choose(a: Candidate | undefined, b: Candidate | undefined) {
  if (!a) return b;
  if (!b) return a;
  if (a.index !== b.index) return a.index < b.index ? a : b;
  return a.lastIndex >= b.lastIndex ? a : b;
}

interface LinkifyIt {
  re: { [key: string]: RegExp };
  /**
   * Adds a rule. See the constructor for the definition.
   *
   * @param schema rule name (fixed pattern prefix)
   * @param definition schema definition
   */
  add(schema: string, definition: string): this;
  add(schema: string, definition: FullRule | null): this;
  /** Sets the options for links without a schema. */
  set(options: Options): this;
  /** Whether the text has a link. */
  test(text: string): boolean;
  /** A quick check that can give false positives: `false` means the text has no link. */
  pretest(text: string): boolean;
  /**
   * The length of the link for `schema` that starts at `pos`, or 0.
   *
   * @param text text to scan
   * @param schema rule (schema) name
   * @param pos text offset to check from
   */
  testSchemaAt(text: string, schema: string, pos: number): number;
  /** Every link in the text, or `null` when there's none. */
  match(text: string): Match[] | null;
  /** The link with a schema at the start of the text, or `null`. */
  matchAtStart(text: string): Match | null;
  /**
   * Replaces the TLDs fuzzy links may end in, or adds to them with `keepOld`.
   *
   * @param list list of tlds
   * @param keepOld merge with current list if `true` (`false` by default)
   */
  tlds(list: string | string[], keepOld?: boolean): this;
  /** The default normalizer, for schemas without their own. */
  normalize(match: Match): void;
  /** Called while compiling; override it to change the regular expressions. */
  onCompile(): void;
}

interface LinkifyItConstructor {
  /**
   * Creates a linkifier, with optional schemas added to `http(s)://`, `ftp://`,
   * `mailto:` and `//`, and options for links without a schema. Works without
   * `new` too.
   */
  new (schemas?: SchemaRules | Options, options?: Options): LinkifyIt;
  (schemas?: SchemaRules | Options, options?: Options): LinkifyIt;
  prototype: LinkifyIt;
}

const LinkifyIt = function LinkifyIt(this: any, schemas?: any, options?: any) {
  if (!(this instanceof LinkifyIt)) return new LinkifyIt(schemas, options);

  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }

  this.__opts__ = assign({}, defaultOptions, options);
  this.__schemas__ = assign({}, defaultSchemas, schemas);
  this.__compiled__ = {};
  this.__tlds__ = tlds_default;
  this.__tlds_replaced__ = false;
  this.re = {};

  compile(this);
} as unknown as LinkifyItConstructor;

const proto: any = LinkifyIt.prototype;

proto.add = function add(schema: string, definition: unknown) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};

proto.set = function set(options: Options) {
  this.__opts__ = assign(this.__opts__, options);
  return this;
};

proto.test = function test(text: string) {
  if (!text.length) return false;

  let m;
  let re;

  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (this.testSchemaAt(text, m[2], re.lastIndex)) return true;
    }
  }

  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    if (text.search(this.re.host_fuzzy_test) >= 0) {
      if (
        text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy) !== null
      )
        return true;
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    // Not skipped without a dot, for cases like 192.168.1.1@gmail.com.
    if (text.indexOf("@") >= 0) {
      if (text.match(this.re.email_fuzzy) !== null) return true;
    }
  }

  return false;
};

proto.pretest = function pretest(text: string) {
  return this.re.pretest.test(text);
};

proto.testSchemaAt = function testSchemaAt(text: string, schema: string, pos: number) {
  if (!this.__compiled__[schema.toLowerCase()]) return 0;
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
};

// An email name ends in one of these, right before the `@`.
const EMAIL_AT = /[-;:&=+$,".\w]@/;

proto.match = function match(text: string) {
  const result: Match[] = [];
  const type_schemed: Candidate[] = [];
  const type_fuzzy_link: Candidate[] = [];
  const type_fuzzy_email: Candidate[] = [];
  let m;
  let len;
  let re;

  if (!text.length) return null;

  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        type_schemed.push({
          schema: m[2],
          index: m.index + m[1].length,
          lastIndex: m.index + m[0].length + len,
        });
      }
    }
  }

  const skip = shortcuts.get(this.re);

  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    re = this.__opts__.fuzzyIP ? this.re.link_fuzzy_global : this.re.link_no_ip_fuzzy_global;
    if (!(skip?.tld && re === skip.link && !skip.tld.test(text))) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        type_fuzzy_link.push({
          schema: "",
          index: m.index + m[1].length,
          lastIndex: m.index + m[0].length,
        });
      }
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    re = this.re.email_fuzzy_global;
    if (!(re === skip?.email && !EMAIL_AT.test(text))) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        type_fuzzy_email.push({
          schema: "mailto:",
          index: m.index + m[1].length,
          lastIndex: m.index + m[0].length,
        });
      }
    }
  }

  const indexes = [0, 0, 0];
  let lastIndex = 0;

  for (;;) {
    const candidates = [
      type_schemed[indexes[0]!],
      type_fuzzy_email[indexes[1]!],
      type_fuzzy_link[indexes[2]!],
    ];

    const candidate = choose(choose(candidates[0], candidates[1]), candidates[2]);

    if (!candidate) break;

    if (candidate === candidates[0]) indexes[0]!++;
    else if (candidate === candidates[1]) indexes[1]!++;
    else indexes[2]!++;

    if (candidate.index < lastIndex) continue;

    const match = new Match(text, candidate.schema, candidate.index, candidate.lastIndex);
    this.__compiled__[match.schema].normalize(match, this);
    result.push(match);
    lastIndex = candidate.lastIndex;
  }

  if (result.length) return result;

  return null;
};

proto.matchAtStart = function matchAtStart(text: string) {
  if (!text.length) return null;

  const m = this.re.schema_at_start.exec(text);
  if (!m) return null;

  const len = this.testSchemaAt(text, m[2], m[0].length);
  if (!len) return null;

  const match = new Match(text, m[2], m.index + m[1].length, m.index + m[0].length + len);

  this.__compiled__[match.schema].normalize(match, this);
  return match;
};

proto.tlds = function tlds(list: string | string[], keepOld?: boolean) {
  list = Array.isArray(list) ? list : [list];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }

  this.__tlds__ = this.__tlds__
    .concat(list)
    .sort()
    .filter((el: string, idx: number, arr: string[]) => el !== arr[idx - 1])
    .reverse();

  compile(this);
  return this;
};

proto.normalize = function normalize(match: Match) {
  if (!match.schema) match.url = `http://${match.url}`;

  if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) {
    match.url = `mailto:${match.url}`;
  }
};

proto.onCompile = function onCompile() {};

export default LinkifyIt;
// What `require("tinylinkify/linkify-it")` returns, as `require("linkify-it")`
// returns the constructor.
export { LinkifyIt as "module.exports" };
