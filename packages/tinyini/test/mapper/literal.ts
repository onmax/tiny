import config from "./config.ini";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.database, { readonly host: "localhost"; readonly port: "5432" }>,
  Equal<typeof config.servers.alpha.hosts, readonly ["a", "b"]>,
] = [true, true];
