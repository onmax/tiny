import config from "./config.yaml";
import docs from "./docs.yml";
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
] = [true, true];
