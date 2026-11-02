import config from "./config.ini";
import type { Equal } from "./equal.ts";

export const check: Equal<
  typeof config,
  {
    name: string;
    debug: boolean;
    database: { host: string; port: string };
    servers: { alpha: { ip: string; hosts: string[] } };
  }
> = true;
