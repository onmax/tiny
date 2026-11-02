import config from "./config.json5";
import infinity from "./infinity.json5";
import nan from "./nan.json5";
import negativeInfinity from "./negative-infinity.json5";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.port, 8080>,
  Equal<typeof config.tags, readonly ["a", "b"]>,
  Equal<typeof infinity, number>,
  Equal<typeof nan, number>,
  Equal<typeof negativeInfinity, number>,
] = [true, true, true, true, true];
