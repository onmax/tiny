// Differential fuzzing of tinylinkify/linkify-it against linkify-it 5.0.2.
// Seeds are linkify-it's fixtures, the benchmark samples and some chat; each
// input gets a few random edits with the pieces linkify-it's patterns care
// about, and goes through pretest, test, match, matchAtStart and testSchemaAt
// on instances set up the same way: each option, `---`, replaced and added
// TLDs, added, aliased and disabled schemas, and a replaced normalizer.
//
// There are two references (scripts/originals.ts). linkify-it as published
// reads punctuation from uc.micro (Unicode 15.1), and tinylinkify from the
// engine, so an input with one of the code points whose class changed since
// may differ from it, and is counted apart. linkify-it with the engine's
// punctuation class must give the same result on every input. Errors must
// match too, by class and message, and so must every `re` source after
// construction, with the punctuation class itself set aside.
// Usage: node scripts/fuzz.ts [iterations] [seed]
import LinkifyIt from "../src/linkify-it/index.ts";
import { changed, onEngine, published } from "./originals.ts";
import { int, mutate, pick, rng, run, SCHEMAS, seeds, SETUPS, type Linkify, type Make } from "./inputs.ts";
import { attempt, count, seeded, show } from "./shared.ts";

const iterations = count(2, 20000);
rng.next = seeded(count(3, 1));
const next = rng.next;

const sides = (setup: (make: Make) => Linkify) =>
  [LinkifyIt, onEngine, published].map((make) => attempt(() => setup(make)));
const instances = SETUPS.map(([name, setup]) => [name, sides(setup)] as const);

let calls = 0;
let differences = 0;
let unicode = 0;
const examples: string[] = [];
const report = (what: string) => {
  differences++;
  if (examples.length < Number(process.env.SHOW ?? 10)) examples.push(what);
};

// Every `re` source after construction, with each side's punctuation class set aside.
const sources = (l: Linkify) =>
  JSON.stringify(
    Object.entries(l.re).map(([key, value]) => [
      key,
      (value instanceof RegExp ? `/${value.source}/${value.flags}` : String(value)).replaceAll(
        l.re.src_P,
        "<P>",
      ),
    ]),
  );
for (const [name, [ours, engine, theirs]] of instances) {
  if (!ours!.ok || !engine!.ok || !theirs!.ok) {
    report(`${name}: setup failed ${JSON.stringify([ours, engine, theirs])}`);
    continue;
  }
  const [a, b, c] = [ours.value, engine.value, theirs.value].map(sources);
  if (a !== b || a !== c) report(`${name}: re differs`);
}

for (let i = 0; i < iterations; i++) {
  let text = pick(seeds);
  if (next() < 0.2) text += pick([" ", "\n", ", ", ""]) + pick(seeds);
  if (next() < 0.9) text = mutate(text);
  const near = changed.some((char) => text.includes(char));
  // Every input goes through the default setup, and one other.
  for (const [name, [ours, engine, theirs]] of [instances[0]!, pick(instances.slice(1))]) {
    const schema = pick(SCHEMAS);
    const pos = int(text.length + 2);
    const [a, b, c] = [ours, engine, theirs].map((l) =>
      JSON.stringify(run((l as { value: Linkify }).value, text, schema, pos)),
    );
    calls += 5 * 3;
    if (a !== b) report(`${name} ${show(text)} ${schema} ${pos}\n  ours   ${a}\n  engine ${b}`);
    else if (a !== c) {
      if (near) unicode++;
      else report(`${name} ${show(text)} ${schema} ${pos}\n  ours   ${a}\n  linkify-it ${c}`);
    }
  }
}

// Arguments of the wrong type, bad definitions and odd options, each from a
// fresh instance on each side.
const ODD: [string, (l: Linkify, make: Make) => unknown][] = [
  ...[undefined, null, 5, {}, [], { length: 3 }, new String("http://a.com"), ["a.com"]].flatMap(
    (value) =>
      (["test", "pretest", "match", "matchAtStart"] as const).map(
        (method) =>
          [`${method}(${show(value)})`, (l: Linkify) => l[method](value)] as [
            string,
            (l: Linkify) => unknown,
          ],
      ),
  ),
  ["add([])", (l) => l.add("test:", [])],
  ["add(validate: [])", (l) => l.add("test:", { validate: [] })],
  ["add(normalize: 'bad')", (l) => l.add("test:", { validate: () => 0, normalize: "bad" })],
  ["add(async validate)", (l) => l.add("test:", { validate: async () => 0 })],
  ["add(5)", (l) => l.add("test:", 5)],
  ["add then test", (l) => (attempt(() => l.add("test:", [])), l.test("http://a.com"))],
  ["add uppercase", (l) => l.add("TEST:", { validate: /^\/\/\w+/ }).match("x test://abc")],
  ["testSchemaAt(undefined)", (l) => l.testSchemaAt("http://a.com", undefined, 5)],
  ["tlds(undefined)", (l) => l.tlds(undefined).match("a.com b.undefined")],
  ["tlds('$&')", (l) => l.tlds("$&", true).match("a.com a.zz")],
  ["tlds(['\\\\1'])", (l) => l.tlds(["\\1"], true).match("a.com a.\u0001 x")],
  ["set('abc')", (l) => (l.set("abc"), l.__opts__)],
  ["set(null)", (l) => (l.set(null), l.match("a.com"))],
  ["options as string", (_, make) => make("fuzzyIP", "x").__opts__],
  ["schemas only", (_, make) => Object.keys(make({ "x:": "http:" }).__schemas__)],
  ["options proto", (_, make) => make(JSON.parse('{"__proto__": {"fuzzyIP": true}}')).__opts__],
  ["shared compiled", (l) => Object.keys(l.__compiled__)],
  ["instance keys", (l) => Object.keys(l)],
];
for (const [name, fn] of ODD) {
  const [a, b, c] = [LinkifyIt, onEngine, published].map((make: Make) =>
    JSON.stringify(attempt(() => fn(make(), make))),
  );
  calls += 3;
  if (a !== b || a !== c) report(`${name}\n  ours   ${a}\n  engine ${b}\n  linkify-it ${c}`);
}

for (const example of examples) console.log(example);
console.log(
  `${iterations} inputs, ${calls} calls: ${differences} differ, ` +
    `${unicode} differ from linkify-it as published only by Unicode version`,
);
process.exitCode = differences ? 1 : 0;
