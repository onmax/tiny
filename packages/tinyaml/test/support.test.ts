// The comparison scripts' shared helpers: a comparator that misses a
// difference, or a stream reader that splits a value, hides a regression.
import { describe, expect, it, vi } from "vite-plus/test";
import { describe as text } from "../scripts/baseline.ts";
import {
  equal,
  expectCount,
  fingerprint,
  iterationsArg,
  jsonStream,
  seedArg,
} from "../scripts/support.ts";

// An array of `length` with only the given indexes set; the rest are holes.
function holes(length: number, values: Record<number, unknown>): unknown[] {
  const array: unknown[] = [];
  array.length = length;
  return Object.assign(array, values);
}

describe("equal", () => {
  it("compares array lengths and holes", () => {
    expect(equal([1], holes(2, { 0: 1 }))).toBe(false);
    expect(equal(holes(3, { 0: 1, 2: 3 }), [1, undefined, 3])).toBe(false);
    expect(equal(holes(3, { 0: 1, 2: 3 }), holes(3, { 0: 1, 2: 3 }))).toBe(true);
    expect(equal(Object.assign([1], { x: 1 }), [1])).toBe(false);
  });

  it("compares array items that aren't enumerable", () => {
    const hidden = (value: unknown) => Object.defineProperty([0], 0, { value, enumerable: false });
    expect(equal(hidden({ x: 1 }), hidden({ x: 1 }))).toBe(true);
    expect(equal(hidden({ x: 1 }), hidden(new Map([["x", 1]])))).toBe(false);
    expect(equal(hidden(1), [1])).toBe(false);
    expect(equal(hidden(1), holes(1, {}))).toBe(false);
  });

  it("compares prototypes, key order and own keys", () => {
    expect(equal({ a: 1 }, Object.assign(Object.create(null), { a: 1 }))).toBe(false);
    expect(equal(new (class A {})(), {})).toBe(false);
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 }, { keyOrder: false })).toBe(true);
    expect(equal({ a: undefined }, {})).toBe(false);
  });

  it("compares enumerable symbol keys too, as describe writes them", () => {
    const s = Symbol.for("review.regression");
    const t = Symbol("t");
    expect(equal({ a: 1, [s]: 1 }, { a: 1 })).toBe(false);
    expect(equal({ a: 1 }, { a: 1, [s]: 1 }, { keyOrder: false })).toBe(false);
    expect(equal(Object.assign([1], { [s]: 1 }), [1])).toBe(false);
    expect(equal({ [s]: 1 }, { [s]: 2 })).toBe(false);
    expect(equal({ [s]: 1, [t]: 1 }, { [t]: 1, [s]: 1 })).toBe(false);
    expect(equal({ [s]: 1, [t]: 1 }, { [t]: 1, [s]: 1 }, { keyOrder: false })).toBe(true);
    const hidden = Object.defineProperty({ a: 1 }, s, { value: 1 });
    expect(equal(hidden, { a: 1 })).toBe(true);
    expect(
      equal({ a: 1, [s]: 1 }, Object.defineProperty({ a: 1, [t]: 1 }, s, { value: 1 }), {
        keyOrder: false,
      }),
    ).toBe(false);
    expect(text({ a: 1, [s]: 1 })).toBe('{"a":1,Symbol.for("review.regression"):1}');
    expect(text(Object.assign([1], { [s]: 1 }))).toBe('[1,Symbol.for("review.regression"):1]');
    const shared = {};
    expect(text({ [s]: shared, a: shared })).toBe('{"a":&1 {},Symbol.for("review.regression"):*1}');
  });

  it("compares numbers as Object.is does", () => {
    expect(equal(NaN, NaN)).toBe(true);
    expect(equal([NaN], [NaN])).toBe(true);
    expect(equal(0, -0)).toBe(false);
    expect(equal(1, "1")).toBe(false);
  });

  it("compares Dates, boxed values, RegExps and errors by value", () => {
    expect(equal(new Date(1), new Date(1))).toBe(true);
    expect(equal(new Date(1), new Date(2))).toBe(false);
    expect(equal(new Number(1), new Number(2))).toBe(false);
    expect(equal(/a/g, /a/i)).toBe(false);
    expect(equal(new Error("a"), new Error("b"))).toBe(false);
  });

  it("compares typed arrays and buffers byte for byte", () => {
    expect(equal(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equal(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(equal(Buffer.from("ab"), Buffer.from("ab"))).toBe(true);
    expect(equal(new Uint8Array([1]), new Int8Array([1]))).toBe(false);
  });

  it("compares Maps and Sets entry by entry, in order", () => {
    expect(equal(new Map([["a", [1]]]), new Map([["a", [1]]]))).toBe(true);
    expect(equal(new Map([["a", [1]]]), new Map([["a", [2]]]))).toBe(false);
    expect(equal(new Set([1, 2]), new Set([2, 1]))).toBe(false);
    expect(equal(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(true);
  });

  it("ends on cycles", () => {
    const a: unknown[] = [1];
    a.push(a);
    const b: unknown[] = [1];
    b.push(b);
    expect(equal(a, b)).toBe(true);
    const c: unknown[] = [2];
    c.push(c);
    expect(equal(a, c)).toBe(false);
  });

  // An alias's value is the anchored object itself: a change through one
  // shows through the other. A copy looks the same until then.
  it("pairs objects one to one, unless told not to", () => {
    const shared = { x: 1 };
    const aliased = { base: shared, copy: shared };
    const copied = { base: { x: 1 }, copy: { x: 1 } };
    expect(equal(aliased, aliased)).toBe(true);
    expect(equal(aliased, { ...aliased })).toBe(true);
    expect(equal(aliased, copied)).toBe(false);
    expect(equal(copied, aliased)).toBe(false);
    expect(equal(aliased, copied, { identity: false })).toBe(true);
    const list = [1];
    expect(equal(new Map([[list, list]]), new Map([[[1], [1]]]))).toBe(false);
    // Each side's object found again with another partner.
    const [p, q] = [{ a: 1 }, { a: 1 }];
    const [r, s] = [{ a: 1 }, { a: 1 }];
    expect(equal([p, q, p], [r, s, r])).toBe(true);
    expect(equal([p, q, p], [r, s, s])).toBe(false);
    const a: unknown[] = [];
    a.push(a, a);
    const b: unknown[] = [];
    b.push(b, [b, b]);
    expect(equal(a, b)).toBe(false);
    expect(equal(a, b, { identity: false })).toBe(true);
    // An object both sides share, as a custom tag can return, pairs too.
    const copy = { ...shared };
    expect(equal([shared, shared], [shared, copy])).toBe(false);
    expect(equal([shared, copy], [shared, shared])).toBe(false);
    expect(equal([aliased, aliased], [aliased, { ...aliased }])).toBe(false);
    expect(equal([shared, copy], [shared, copy])).toBe(true);
    expect(equal([aliased, aliased], [aliased, aliased])).toBe(true);
  });
});

// A baseline record holds describe's text of each side's value, so a
// difference equal() finds that describe doesn't write passes as recorded:
// a Date given an extra key once did.
describe("describe", () => {
  const date = (time: number, extra?: object) => Object.assign(new Date(time), extra);
  const s = Symbol("s");
  const t = Symbol("s");
  const global = Symbol.for("s");
  const shared = { x: 1 };
  const cycle = (): unknown[] => {
    const a: unknown[] = [];
    a.push(a);
    return a;
  };
  const two = (): unknown[] => {
    const a: unknown[] = [];
    a.push([a]);
    return a;
  };
  const f = () => 1;
  const g = () => 1;
  const [A1, A2] = [class A {}, class A {}];
  const Anonymous = [class {}][0]!;
  class Map2 extends Map {}
  const proto = { a: 1 };
  const pairs: [string, unknown, unknown][] = [
    [
      "an array index that isn't enumerable",
      [1],
      Object.defineProperty([1], 0, { enumerable: false }),
    ],
    ["Dates", date(1), date(1)],
    ["Dates at other times", date(1), date(2)],
    ["invalid Dates", new Date(NaN), new Date(NaN)],
    ["a Date with an extra key", date(1, { reviewSentinel: 1 }), date(1)],
    ["a Date with an extra symbol", date(1, { [s]: 1 }), date(1)],
    ["Dates with other extra values", date(1, { a: 1 }), date(1, { a: 2 })],
    ["boxed numbers", new Number(1), new Number(2)],
    ["boxed zeros", new Number(0), new Number(-0)],
    ["a boxed number and a number", new Number(1), 1],
    ["boxed strings", new String("ab"), new String("ac")],
    ["a boxed string with an extra key", Object.assign(new String("a"), { x: 1 }), new String("a")],
    ["boxed booleans", new Boolean(true), new Boolean(false)],
    ["boxed bigints", Object(1n), Object(2n)],
    ["boxed symbols", Object(s), Object(t)],
    ["the same boxed symbol", Object(s), Object(s)],
    ["buffers", new Uint8Array([1, 2]).buffer, new Uint8Array([1, 3]).buffer],
    ["equal buffers", new Uint8Array([1, 2]).buffer, new Uint8Array([1, 2]).buffer],
    ["a buffer and a view", new Uint8Array([1]).buffer, new Uint8Array([1])],
    [
      "a typed array with an extra key",
      Object.assign(new Uint8Array([1]), { x: 1 }),
      new Uint8Array([1]),
    ],
    [
      "DataViews",
      new DataView(new Uint8Array([1]).buffer),
      new DataView(new Uint8Array([2]).buffer),
    ],
    ["Maps", new Map([[1, 2]]), new Map([[1, 3]])],
    ["a Map with an extra key", Object.assign(new Map(), { x: 1 }), new Map()],
    ["a Map subclass", new Map2(), new Map()],
    ["Sets", new Set([1]), new Set(["1"])],
    ["a Set with an extra key", Object.assign(new Set(), { x: 1 }), new Set()],
    ["RegExps", /a/g, /a/i],
    ["a RegExp with an extra key", Object.assign(/a/, { x: 1 }), /a/],
    ["errors with an extra key", Object.assign(new Error("a"), { mark: 1 }), new Error("a")],
    ["errors of another class", new TypeError("a"), new Error("a")],
    ["two symbols of one description as keys", { [s]: 1 }, { [t]: 1 }],
    ["a registered symbol and a local one", { [global]: 1 }, { [s]: 1 }],
    ["the same symbol as keys", { [s]: 1 }, { [s]: 1 }],
    ["two symbols of one description", s, t],
    ["a symbol and a string", s, "Symbol(s)"],
    ["two functions of one source", f, g],
    ["the same function", f, f],
    ["two classes of one name", new A1(), new A2()],
    ["an anonymous class and an object", new Anonymous(), {}],
    ["a prototype without a constructor", Object.create(proto), Object.create({ a: 1 })],
    ["the same prototype without a constructor", Object.create(proto), Object.create(proto)],
    ["a null prototype's child", Object.create(Object.create(null)), Object.create(null)],
    ["an array's key that isn't an index", Object.assign([1], { "01": 2 }), [1]],
    ["holes", holes(2, { 1: 1 }), [undefined, 1]],
    ["-0", [-0], [0]],
    ["key order", { a: 1, b: 2 }, { b: 2, a: 1 }],
    ["shared objects", [shared, shared], [shared, { x: 1 }]],
    ["the same shared objects", [shared, shared], [{ x: 1 }, { x: 1 }].fill(shared)],
    ["cycles", cycle(), two()],
    ["equal cycles", cycle(), cycle()],
  ];

  it.each(pairs)("writes the same text exactly where equal() agrees: %s", (_, a, b) => {
    expect(text(a) === text(b)).toBe(equal(a, b));
  });

  it("writes an object's items or contents before its other keys", () => {
    expect(text(Object.assign([shared], { x: shared }))).toBe('[&1 {"x":1},"x":*1]');
    expect(text(Object.assign(new Set([shared]), { x: shared }))).toBe('Set[&1 {"x":1}]{"x":*1}');
    expect(text(date(0, { a: 1 }))).toBe('Date(1970-01-01T00:00:00.000Z){"a":1}');
  });
});

// The js-yaml replays count a call made in several tests once, by this.
describe("fingerprint", () => {
  it("tells apart callbacks inspect prints alike", () => {
    const tag = (finalize: () => unknown) => ({ tags: [{ finalize }] });
    expect(fingerprint(tag(() => 1))).not.toBe(fingerprint(tag(() => 2)));
    expect(fingerprint(tag(() => 1))).toBe(fingerprint(tag(() => 1)));
  });

  it("reads the whole value", () => {
    const deep = (leaf: number) => ({ a: { b: { c: { d: { e: { f: leaf } } } } } });
    expect(fingerprint(deep(1))).not.toBe(fingerprint(deep(2)));
    const long = (last: number) => [...Array.from({ length: 200 }, () => 0), last];
    expect(fingerprint(long(1))).not.toBe(fingerprint(long(2)));
  });
});

describe("jsonStream", () => {
  it("reads whole values, numbers included", () => {
    expect(jsonStream("123\n")).toEqual([123]);
    expect(jsonStream("12.5\n-3e2\n")).toEqual([12.5, -300]);
    expect(jsonStream("1 23")).toEqual([1, 23]);
    expect(jsonStream("true\nfalse\nnull\n")).toEqual([true, false, null]);
    expect(jsonStream('"a \\" ]" "b"')).toEqual(['a " ]', "b"]);
    expect(jsonStream('{"a":[1,{"b":"}"}]}\n[2,3]\n')).toEqual([{ a: [1, { b: "}" }] }, [2, 3]]);
    expect(jsonStream("")).toEqual([]);
  });

  it("throws on what isn't JSON", () => {
    expect(() => jsonStream("[1,")).toThrow();
    expect(() => jsonStream("nope")).toThrow();
  });
});

describe("run arguments", () => {
  // N=not-a-number once ran every fuzzer for no iterations, and passed.
  it("take a positive integer count and an integer seed", () => {
    expect(iterationsArg(undefined, 5000)).toBe(5000);
    expect(iterationsArg("20", 5000)).toBe(20);
    for (const arg of ["not-a-number", "", "0", "-1", "1.5", "Infinity", "1e300"])
      expect(() => iterationsArg(arg, 1)).toThrow(/positive integer/);
    expect(seedArg(undefined)).toBe(1);
    expect(seedArg("-3")).toBe(-3);
    for (const arg of ["x", "NaN", "0.5", "Infinity"])
      expect(() => seedArg(arg)).toThrow(/integer/);
  });

  it("fail a count that is NaN", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expectCount("crashes", NaN, 0);
      expect(process.exitCode).toBe(1);
      expect(log).toHaveBeenCalledWith("FAIL crashes: NaN, expected 0");
    } finally {
      process.exitCode = undefined;
      log.mockRestore();
    }
  });
});
