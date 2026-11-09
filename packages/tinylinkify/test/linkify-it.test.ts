// What tinylinkify/linkify-it does beyond what linkify-it's own tests and the
// fuzzer check (scripts/linkify-it-tests.ts, scripts/fuzz.ts).
import { createRequire } from "node:module";
import { describe, expect, it } from "vite-plus/test";
import LinkifyIt from "../src/linkify-it/index.ts";

describe("tinylinkify/linkify-it", () => {
  it("is what require() returns, as linkify-it's CommonJS build is", () => {
    // Node loads the file again for require(), so it's another copy of the constructor.
    const required = createRequire(import.meta.url)("../src/linkify-it/index.ts");
    expect(typeof required).toBe("function");
    expect(required.name).toBe(LinkifyIt.name);
    expect(required().match("a.com")[0].url).toBe("http://a.com");
  });

  it("keeps `re`'s sources usable without the u flag, as linkify-it's README uses them", () => {
    const l = LinkifyIt().add("@", {
      validate(text, pos, self: any) {
        const tail = text.slice(pos);
        if (!self.re.twitter)
          self.re.twitter = new RegExp(`^([a-zA-Z0-9_]){1,15}(?!_)(?=$|${self.re.src_ZPCc})`);
        return self.re.twitter.test(tail) ? tail.match(self.re.twitter)![0].length : 0;
      },
      normalize(m) {
        m.url = `https://twitter.com/${m.url.replace(/^@/, "")}`;
      },
    });
    expect(l.match("hello, @gamajoba_!")?.[0]?.text).toBe("@gamajoba_");
    expect(new RegExp(`^(?:${l.re.src_P})$`).test("«")).toBe(true);
    expect(new RegExp(`^(?:${l.re.src_P})$`).test("\u{10100}")).toBe(true);
    expect(new RegExp(`^(?:${l.re.src_P})$`).test("a")).toBe(false);
  });

  it("reads punctuation from the engine, once", () => {
    const [a, b] = [LinkifyIt(), LinkifyIt()];
    expect(a.re.src_P).toBe(b.re.src_P);
    // U+1B7F, BALINESE PANTI BAWAK, came in Unicode 16; uc.micro 2.1.0 has 15.1.
    const engine = /\p{P}/u.test("᭿");
    expect(new RegExp(`^(?:${a.re.src_P})$`).test("᭿")).toBe(engine);
  });

  it("keeps the fuzzy link pattern well under the 20 KiB where V8 stops optimizing", () => {
    expect(LinkifyIt().re.link_fuzzy_global!.source.length).toBeLessThan(15_000);
    expect(
      LinkifyIt().tlds(["onion", "local", "internal"], true).re.link_fuzzy_global!.source.length,
    ).toBeLessThan(15_000);
  });
});
