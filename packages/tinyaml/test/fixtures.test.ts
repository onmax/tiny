import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { growth } from "./fixtures.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("growth", () => {
  it("measures linear work when optimization finishes during sampling", () => {
    let elapsed = 0;
    let calls = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const ratio = growth(
      (n) => "a".repeat(n),
      (text) => {
        // Model a fivefold speedup after the first six reads.
        elapsed += text.length * (++calls <= 6 ? 5 : 1);
      },
      1000,
    );
    expect(ratio).toBe(8);
  });

  it("keeps quadratic work above the scaling tests' limit", () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const ratio = growth(
      (n) => "a".repeat(n),
      (text) => {
        elapsed += text.length ** 2;
      },
      1000,
    );
    expect(ratio).toBe(64);
  });
});
