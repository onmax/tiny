// The inputs and setups the linkify-it fuzzers share: seeds, the pieces that
// edit them, and instances set up the same way on each side.
import { changed } from "./originals.ts";
import { attempt, benchSamples, fixtureLines } from "./shared.ts";

export type Linkify = any;
export type Make = (options?: unknown, more?: unknown) => Linkify;

/** The random number source the edits draw from; scripts set its seed. */
export const rng = { next: Math.random };
export const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;
export const int = (n: number): number => Math.floor(rng.next() * n);



// Instances set up the same way on each side: [name, setup].
const twitter = (make: Make) =>
  make().add("@", {
    validate(text: string, pos: number, self: Linkify) {
      const tail = text.slice(pos);
      if (!self.re.twitter)
        self.re.twitter = new RegExp(`^([a-zA-Z0-9_]){1,15}(?!_)(?=$|${self.re.src_ZPCc})`);
      if (self.re.twitter.test(tail)) {
        if (pos >= 2 && tail[pos - 2] === "@") return false;
        return tail.match(self.re.twitter)[0].length;
      }
      return 0;
    },
    normalize(m: { url: string }) {
      m.url = `https://twitter.com/${m.url.replace(/^@/, "")}`;
    },
  });
export const SETUPS: [string, (make: Make) => Linkify][] = [
  ["default", (make) => make()],
  ["fuzzyIP", (make) => make({ fuzzyIP: true })],
  ["no fuzzyLink", (make) => make({ fuzzyLink: false })],
  ["no fuzzyEmail", (make) => make().set({ fuzzyEmail: false })],
  ["---", (make) => make(null, { "---": true })],
  ["--- and fuzzyIP", (make) => make({}, { "---": true, fuzzyIP: true })],
  ["tlds replaced", (make) => make().tlds(["onion", "co", "рф", "xn--p1ai"])],
  ["tlds added", (make) => make().tlds("myroot", true).tlds(["zz", "com"], true)],
  ["tlds added, fuzzyIP", (make) => make({ fuzzyIP: true }).tlds(["local"], true)],
  ["twitter", twitter],
  [
    "schemas",
    (make) =>
      make({ "git:": "http:", "My:": { validate: /^\/\/[a-z]+/ }, "skype:": { validate: /^\w+/ } }),
  ],
  [
    "disabled",
    (make) => make().add("http:", null).add("mailto:", null).add("ftp:", "missing:"),
  ],
  [
    "normalizer",
    (make) => {
      const l = make();
      l.normalize = function (this: unknown, m: { url: string; text: string }) {
        m.text = m.text.toUpperCase();
        m.url += "#n";
      };
      return l;
    },
  ],
  [
    "onCompile",
    (make) => {
      const l = make();
      l.onCompile = function (this: { re: Record<string, string> }) {
        this.re.tpl_email_fuzzy = this.re.tpl_email_fuzzy.replace("@", "(?:@|\\[at\\])");
      };
      return l.tlds("io", true);
    },
  ],
];

const chat = [
  "hey @alice can you check https://github.com/vercel/chat/pull/1#issuecomment-123?",
  "@bob @carol see www.example.com and docs.example.org/guide (thanks!)",
  "mail me: a.b+c@example.co.uk, or ping @dave_99",
  "build failed at http://localhost:3000/api?x=1&y=2. retrying…",
  "“quoted https://example.com/путь” and 例え.テスト/パス and 1.2.3.4:8080",
];
export const seeds = [
  ...fixtureLines(),
  ...chat,
  ...Object.values(benchSamples()).flatMap((text) => text.split(/(?<=[.!?\n])\s+/)),
];

export const pieces = [
  "http://",
  "https://",
  "HTTP://",
  "ftp://",
  "mailto:",
  "//",
  "///",
  "www.",
  ".com",
  ".org",
  ".io",
  ".рф",
  ".xn--p1ai",
  "xn--80ak6aa92e",
  ".museum",
  ".comx",
  "localhost",
  "1.2.3.4",
  "255.255.255.256",
  ":8080",
  ":65536",
  "@",
  "user:pass@",
  "a@b.co",
  ":",
  "/",
  "?",
  "#",
  "&",
  "=",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  '"',
  "'",
  ".",
  "..",
  "...",
  ",",
  ";",
  "!",
  "!!",
  "-",
  "--",
  "---",
  "_",
  "<",
  ">",
  "｜",
  "|",
  "$",
  "+",
  "^",
  "`",
  "\\",
  " ",
  "\n",
  "\t",
  " ",
  " ",
  "　",
  "​",
  "­",
  "\u0085",
  "\u001f",
  "\u007f",
  "a",
  "Z",
  "0",
  "9",
  "é",
  "ß",
  "ſ",
  "K",
  "例",
  "点看",
  "пример",
  "ä",
  "😀",
  "𝒳",
  "\ud800",
  "\udc00",
  "\udbff",
  "«",
  "»",
  "。",
  "、",
  "！",
  "？",
  "“",
  "”",
  "‘",
  "’",
  "–",
  "—",
  "…",
  "¿",
  "§",
  "·",
  "、",
  "・",
  "︐",
  "，",
  // Punctuation in the engine's Unicode that uc.micro's tables don't have.
  ...changed,
];

export function mutate(text: string): string {
  const edits = 1 + int(4);
  for (let i = 0; i < edits; i++) {
    const at = int(text.length + 1);
    switch (int(5)) {
      case 0:
      case 1:
        text = text.slice(0, at) + pick(pieces) + text.slice(at);
        break;
      case 2:
        text = text.slice(0, at) + text.slice(at + 1 + int(4));
        break;
      case 3:
        text = text.slice(0, at) + pick(pieces) + text.slice(at + 1 + int(3));
        break;
      default: {
        const from = int(text.length);
        text = text.slice(0, at) + text.slice(from, from + int(12)) + text.slice(at);
      }
    }
  }
  return text;
}

// What a match result is, field by field, in key order.
export const shape = (m: Record<string, unknown> | null) => (m ? JSON.stringify(Object.entries(m)) : null);
export const SCHEMAS = ["http:", "HTTPS:", "//", "mailto:", "ftp:", "git:", "@", "bad:"];

export function run(l: Linkify, text: string, schema: string, pos: number) {
  return [
    attempt(() => l.pretest(text)),
    attempt(() => l.test(text)),
    attempt(() => l.match(text)?.map(shape) ?? null),
    attempt(() => shape(l.matchAtStart(text))),
    attempt(() => l.testSchemaAt(text, schema, pos)),
  ];
}

