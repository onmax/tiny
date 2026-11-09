// linkify-it 5.0.2's lib/re.mjs: the regular expression sources a LinkifyIt
// instance exposes as `re`, string for string, so validators built from them
// behave the same. The one change is where the Unicode classes come from:
// linkify-it imports them from uc.micro 2.1.0 (Unicode 15.1), and this builds
// `src_P` from the engine's own `\p{P}`, once, the first time it's needed.
// The sources stay valid without the `u` flag, since callers build their own
// regular expressions from them that way.

const ANY =
  "[\\0-\\uD7FF\\uE000-\\uFFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF]";
const CC = "[\\0-\\x1F\\x7F-\\x9F]";
const Z = "[ \\xA0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]";

// A code unit as a class writes it: escaped when it's a surrogate or means
// something in a class, and as itself otherwise, which keeps the patterns
// short. V8 stops optimizing a pattern longer than 20 KiB, and linkify-it's
// fuzzy link pattern, which holds this class nine times, is 19 KiB with
// uc.micro's.
const unit = (code: number) =>
  code >= 0xd800 && code < 0xe000
    ? `\\u${code.toString(16)}`
    : `${"\\]^-[".includes(String.fromCharCode(code)) ? "\\" : ""}${String.fromCharCode(code)}`;

let punctuation: string | undefined;

/**
 * `\p{P}` as uc.micro writes it: a class of BMP code units, then each high
 * surrogate with a class of the low ones after it. Unicode has punctuation in
 * planes 0 and 1 only, so the scan stops at U+1FFFF.
 */
function P(): string {
  if (punctuation) return punctuation;
  const units = new Uint16Array(0x30000);
  for (let c = 0; c < 0x10000; c++) {
    units[c] = c;
    units[0x10000 + 2 * c] = 0xd800 + (c >> 10);
    units[0x10001 + 2 * c] = 0xdc00 + (c & 1023);
  }
  let all = "";
  for (let i = 0; i < units.length; i += 8192)
    all += String.fromCharCode.apply(null, units.subarray(i, i + 8192) as unknown as number[]);
  let out = "[";
  let high = 0;
  let from = -1;
  let to = -2;
  const flush = () => {
    if (from >= 0) out += unit(from) + (to > from + 1 ? "-" : "") + (to > from ? unit(to) : "");
    from = -1;
  };
  for (const m of all.matchAll(/\p{P}/gu)) {
    let code = m.index;
    let lead = 0;
    if (code >= 0x10000) {
      lead = all.charCodeAt(code);
      code = all.charCodeAt(code + 1);
    }
    if (lead !== high) {
      flush();
      out += `]|${unit((high = lead))}[`;
    }
    if (code !== to + 1) flush();
    if (from < 0) from = code;
    to = code;
  }
  flush();
  return (punctuation = `${out}]`);
}

export default function reFactory(opts: any): Record<string, any> {
  const re: Record<string, any> = {};
  opts = opts || {};

  re.src_Any = ANY;
  re.src_Cc = CC;
  re.src_Z = Z;
  re.src_P = P();

  re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join("|");
  re.src_ZCc = [re.src_Z, re.src_Cc].join("|");

  const text_separators = "[><\uff5c]";

  re.src_pseudo_letter = `(?:(?!${text_separators}|${re.src_ZPCc})${re.src_Any})`;

  re.src_ip4 =
    "(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";

  re.src_auth = `(?:(?:(?!${re.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`;

  re.src_port = "(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?";

  re.src_host_terminator =
    `(?=$|${text_separators}|${re.src_ZPCc})` +
    `(?!${opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${re.src_ZPCc}))`;

  re.src_path =
    "(?:" +
    "[/?#]" +
    "(?:" +
    `(?!${re.src_ZCc}|${text_separators}|[()[\\]{}.,"'?!\\-;]).|` +
    `\\[(?:(?!${re.src_ZCc}|\\]).)*\\]|` +
    `\\((?:(?!${re.src_ZCc}|[)]).)*\\)|` +
    `\\{(?:(?!${re.src_ZCc}|[}]).)*\\}|` +
    `\\"(?:(?!${re.src_ZCc}|["]).)+\\"|` +
    `\\'(?:(?!${re.src_ZCc}|[']).)+\\'|` +
    `\\'(?=${re.src_pseudo_letter}|[-])|` +
    "\\.{2,}[a-zA-Z0-9%/&]|" +
    `\\.(?!${re.src_ZCc}|[.]|$)|` +
    (opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") +
    `,(?!${re.src_ZCc}|$)|` +
    `;(?!${re.src_ZCc}|$)|` +
    `\\!+(?!${re.src_ZCc}|[!]|$)|` +
    `\\?(?!${re.src_ZCc}|[?]|$)` +
    ")+" +
    "|\\/" +
    ")?";

  re.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]{0,63}';

  re.src_xn = "xn--[a-z0-9\\-]{1,59}";

  re.src_domain_root = `(?:${re.src_xn}|${re.src_pseudo_letter}{1,63})`;

  re.src_domain =
    `(?:${re.src_xn}|(?:${re.src_pseudo_letter})|` +
    `(?:${re.src_pseudo_letter}(?:-|${re.src_pseudo_letter}){0,61}${re.src_pseudo_letter}))`;

  re.src_host = `(?:(?:(?:(?:${re.src_domain})\\.)*${re.src_domain}))`;

  re.tpl_host_fuzzy = `(?:${re.src_ip4}|(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%)))`;

  re.tpl_host_no_ip_fuzzy = `(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%))`;

  re.src_host_strict = re.src_host + re.src_host_terminator;
  re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
  re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
  re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
  re.tpl_host_port_no_ip_fuzzy_strict =
    re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;

  re.tpl_host_fuzzy_test = `localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:${re.src_ZPCc}|>|$))`;

  re.tpl_email_fuzzy =
    `(^|${text_separators}|"|\\(|${re.src_ZCc})` +
    `(${re.src_email_name}@${re.tpl_host_fuzzy_strict})`;

  re.tpl_link_fuzzy =
    `(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uff5c]|${re.src_ZPCc}))` +
    `((?![$+<=>^\`|\uff5c])${re.tpl_host_port_fuzzy_strict}${re.src_path})`;

  re.tpl_link_no_ip_fuzzy =
    `(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uff5c]|${re.src_ZPCc}))` +
    `((?![$+<=>^\`|\uff5c])${re.tpl_host_port_no_ip_fuzzy_strict}${re.src_path})`;

  return re;
}
