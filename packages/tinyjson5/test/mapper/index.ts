import config from "./config.json5";
import emptyArray from "./empty-array.json5";
import settings from "./settings.jsonc";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<
    typeof config,
    {
      name: string;
      port: number;
      ratio: number;
      tags: string[];
      nested: { on: boolean; off: null };
      ["__proto__"]: number;
    }
  >,
  Equal<typeof settings, { strict: boolean; paths: string[] }>,
  Equal<typeof emptyArray, never[]>,
] = [true, true, true];
