import config from "./config.yaml";
import empty from "./empty.yaml";
import emptyArray from "./empty-array.yaml";
import emptyArrays from "./empty-arrays.yaml";
import emptyDocs from "./empty-docs.yml";
import infinity from "./infinity.yaml";
import scalars from "./scalars.yml";
import type { Equal } from "./equal.ts";

export const checks: [
  Equal<typeof config.staging, { readonly host: "localhost"; readonly port: 8081 }>,
  Equal<typeof config.tags, readonly ["a", "b"]>,
  Equal<typeof empty, undefined>,
  Equal<typeof infinity, number>,
  Equal<typeof scalars, readonly [number, number, 42]>,
  Equal<typeof emptyArray, readonly []>,
  Equal<typeof emptyArrays, { readonly first: readonly []; readonly again: readonly [] }>,
  Equal<typeof emptyDocs, readonly [readonly [], { readonly nested: readonly [] }]>,
] = [true, true, true, true, true, true, true, true];
