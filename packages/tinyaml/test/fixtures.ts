// The conformance tests run scripts against what `pnpm fixtures` downloads
// into .cache. Without it they skip, so a fresh clone's `pnpm test` passes;
// on CI they always run, and fail if a fixture is missing.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export const missing = (path: string): boolean => !existsSync(path) && !process.env.CI;

/** Runs a script with this Node; its non-zero exit fails the test, output included. */
export const run = (script: string, ...args: string[]): string =>
  execFileSync(process.execPath, ["--no-warnings", script, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

// How much longer reading the text for 8n takes than for n, after a warm-up
// run and the best of five: about 8 when the work is linear, 64 when it's
// quadratic. Tests check it stays under 32, since a busy CI runner can
// slow one side two or three times.
export function growth(
  text: (n: number) => string,
  read: (text: string) => unknown,
  n: number,
): number {
  const best = (input: string) => {
    read(input);
    let fastest = Infinity;
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      read(input);
      fastest = Math.min(fastest, performance.now() - start);
    }
    return fastest;
  };
  return best(text(8 * n)) / best(text(n));
}
