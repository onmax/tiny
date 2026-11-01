// Code written against the linter, its ESLint plugin and its Vite Doctor
// extension. scripts/types-compat.ts typechecks it against tinyaml's source,
// and with the imports of it rewritten to "tinyaml/<entry>", against the
// packed package.
import type { Linter } from "eslint";
import { defineDoctorConfig } from "vite-doctor/config";
import doctor, { type DoctorOptions } from "../../src/doctor.ts";
import plugin from "../../src/eslint.ts";
import {
  lint,
  lintFiles,
  rules,
  type Diagnostic,
  type LintedFile,
  type Rule,
} from "../../src/linter.ts";

const rule: Rule = "tinyaml/ambiguous-value";
const found: Diagnostic[] = lint("draft: no\n");
const files: Promise<LintedFile[]> = lintFiles(["a.yaml"], async () => "draft: no\n");
const code: string = rules[rule].code;
const eslint: Linter.Config[] = [
  plugin.configs.recommended,
  { files: ["**/*.yaml"], plugins: { tinyaml: plugin }, rules: { [rule]: "error" } },
];
const options: DoctorOptions = { exclude: ["**/dist/**"] };
const config = defineDoctorConfig({
  extends: ["tinyaml/recommended"],
  extensions: [doctor(options)],
});
export { found, files, code, eslint, config };
