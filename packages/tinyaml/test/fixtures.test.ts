import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { LINEAR, slope } from "./fixtures.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// CPU time that grows with each read as `cost` says, in microseconds.
const clock = (cost: (length: number, call: number) => number) => {
  let spent = 0;
  let calls = 0;
  vi.spyOn(process, "cpuUsage").mockImplementation(() => ({ user: spent, system: 0 }));
  return (text: string) => {
    spent += cost(text.length, ++calls);
  };
};

describe("slope", () => {
  it("measures linear work when optimization finishes during sampling", () => {
    // A fivefold speedup after the first six reads.
    const read = clock((length, call) => (length / 100) * (call <= 6 ? 5 : 1));
    expect(slope((n) => "a".repeat(n), read)).toBeCloseTo(1, 5);
  });

  it("keeps quadratic work above the scaling tests' limit", () => {
    const read = clock((length) => length ** 2 / 1e6);
    const measured = slope((n) => "a".repeat(n), read);
    expect(measured).toBeGreaterThan(LINEAR);
    expect(measured).toBeCloseTo(2, 5);
  });
});
