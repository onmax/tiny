import config from "./config.json5";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.port, 8080>,
  Equal<typeof config.tags, readonly ["a", "b"]>,
] = [true, true];
