import config from "./config.yaml";
import empty from "./empty.yaml";
import infinity from "./infinity.yaml";
import scalars from "./scalars.yml";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.staging, { readonly host: "localhost"; readonly port: 8081 }>,
  Equal<typeof config.tags, readonly ["a", "b"]>,
  Equal<typeof empty, undefined>,
  Equal<typeof infinity, number>,
  Equal<typeof scalars, readonly [number, number, 42]>,
] = [true, true, true, true, true];
