export { scan, packageManager, gitChanges } from "./detect.ts";
export type { Field, Found, PackageManager, Project } from "./detect.ts";
export { LIBRARIES, libraryOf, parseVersion } from "./libraries.ts";
export type { Library, Tiny, Version } from "./libraries.ts";
export { apply, plan } from "./migrate.ts";
export type { Change, Edit, FileEdit, ManifestEdit, Plan, Skipped } from "./migrate.ts";
export { findSpecifiers, replaceSpecifiers } from "./rewrite.ts";
export type { Specifier } from "./rewrite.ts";
