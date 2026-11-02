import config from "./config.yaml";
import docs from "./docs.yml";
import emptyArray from "./empty-array.yaml";
import emptyArrays from "./empty-arrays.yaml";
import emptyDocs from "./empty-docs.yml";
import type { Equal } from "./equal.ts";

type Server = { host: string; port: number };

export const checks: [
  Equal<
    typeof config,
    {
      server: Server;
      staging: Server;
      mirrors: Server[];
      tags: string[];
      ratio: number;
      empty: null;
      ["__proto__"]: number;
    }
  >,
  Equal<typeof docs, readonly [{ name: string }, { name: string; count: number }]>,
  Equal<typeof emptyArray, never[]>,
  Equal<typeof emptyArrays, { first: never[]; again: never[] }>,
  Equal<typeof emptyDocs, readonly [never[], { nested: never[] }]>,
] = [true, true, true, true, true];
