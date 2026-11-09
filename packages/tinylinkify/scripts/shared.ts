// Helpers the differential scripts share.
import { readdirSync, readFileSync } from "node:fs";

export type Outcome = { ok: true; value: unknown } | { ok: false; error: string };

export function attempt(fn: () => unknown): Outcome {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (!(error instanceof Error)) return { ok: false, error: `non-error ${String(error)}` };
    return { ok: false, error: `${error.constructor.name}: ${error.message}` };
  }
}

/** Mulberry32: numbers in [0, 1) from a seed, the same on every run. */
export function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The number in argument `index` of the command line, or `fallback`. */
export const count = (index: number, fallback: number): number =>
  Number(process.argv[index] ?? fallback) || fallback;

/** A short, readable form of a string for a report. */
export const show = (text: unknown): string => JSON.stringify(text)?.slice(0, 160) ?? String(text);

/** linkify-it's link and not-link fixtures, one input per line, comments and expected URLs dropped. */
export function fixtureLines(): string[] {
  const lines: string[] = [];
  for (const file of ["links.txt", "not_links.txt"])
    for (const line of readFileSync(`test/suites/linkify-it-5.0.2/fixtures/${file}`, "utf8").split(
      /\r?\n/,
    ))
      if (line.trim() && !line.startsWith("%")) lines.push(line.replace(/ +%.*$/, ""), line);
  return lines;
}

/** The benchmark samples: linkify-it's own, and chat messages. */
export function benchSamples(): Record<string, string> {
  return Object.fromEntries(
    readdirSync("bench/samples")
      .filter((file) => file.endsWith(".txt"))
      .sort()
      .map((file) => [file.slice(0, -4), readFileSync(`bench/samples/${file}`, "utf8")]),
  );
}
