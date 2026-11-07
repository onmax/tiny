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

// The CPU time the process has spent, in microseconds. Node counts a
// thread's time only to about a tenth of a millisecond.
const cpu = () => {
  const { user, system } = process.cpuUsage();
  return user + system;
};

// Halfway from linear to quadratic: on a busy machine, a linear reader's
// slope has come out at up to 1.45, and the quadratic ones these tests caught
// at 1.7 and more.
export const LINEAR = 1.5;

// How the time reading `text(n)` takes grows with n: the slope of its
// logarithm against n's, about 1 when the work is linear and 2 when it's
// quadratic; tests check it stays under LINEAR. It reads the n that makes
// about `chars` characters, and 16 times as many, enough for quadratic work
// to show over the linear, each up to ten times, while they take less than
// 100 ms in all, and keeps the fastest. On the way it reads 4 times as many,
// and when the slope there is already over 1.8 it reads 16 times as many just
// once more, so a quadratic reader fails soon; a linear one on CI once came
// out at 1.87 there.
// A slope over its limit is measured up to twice more, with the fastest runs
// of all rounds, since a busy machine may hold up the compiler or share a
// core's caches for one. It counts CPU time, which a busy machine stretches
// far less than the time on the clock, and leaves errors without the stack
// trace that makes each one slow to make.
export function slope(
  text: (n: number) => string,
  read: (text: string) => unknown,
  chars = 16_000,
): number {
  const n = Math.ceil(chars / (text(2).length - text(1).length));
  // The fastest run of each size so far.
  const fastest: Record<number, number> = {};
  const best = (size: number) => {
    const input = text(size * n);
    for (let run = 0, spent = 0; run < 10 && spent < 100_000; run++) {
      const start = cpu();
      read(input);
      const took = cpu() - start;
      fastest[size] = Math.min(fastest[size] ?? Infinity, took);
      spent += took;
    }
    return fastest[size]!;
  };
  const growth = (size: number, limit: number) => {
    let measured = Infinity;
    for (let round = 0; round < 3 && measured > limit; round++)
      measured = Math.log(best(size) / best(1)) / Math.log(size);
    return measured;
  };
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 0;
  try {
    if (growth(4, 1.8) > 1.8) return Math.log(best(16) / best(1)) / Math.log(16);
    return growth(16, LINEAR);
  } finally {
    Error.stackTraceLimit = limit;
  }
}
