import config from "./config.yaml";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.staging, { readonly host: "localhost"; readonly port: 8081 }>,
  Equal<typeof config.tags, readonly ["a", "b"]>,
] = [true, true];
