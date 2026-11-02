import {
  createRule,
  defineDoctorDiagnostics,
  defineDoctorExtension,
  defineRulePack,
  type RuleContext,
} from "vite-doctor/extension";
import { lintFiles, rules, type LintedFile, type Rule } from "./linter.ts";

export interface DoctorOptions {
  /** YAML to check, relative to the project root. Default `**\/*.{yaml,yml}`. */
  include?: string;
  /** Globs to skip. Default `node_modules` and `dist`. */
  exclude?: readonly string[];
}

// SAFETY: the keys of `rules` are exactly the rules.
const ids = Object.keys(rules) as Rule[];

const diagnostics = defineDoctorDiagnostics(
  ids.map((ruleId) => ({ code: rules[ruleId].code, ruleId })),
  {
    docsBase: (code) => {
      const rule = ids.find((id) => rules[id].code === code);
      return rule && `https://tiny.onmax.me/tinyaml/linter/overview/#${rule.replace("/", "")}`;
    },
  },
);

/**
 * A Doctor Extension that lints the project's YAML with tinyaml. Register it in
 * `doctor.config.ts` and run `vite-doctor . --config doctor.config.ts`.
 */
export default function tinyaml(options: DoctorOptions = {}) {
  const { include = "**/*.{yaml,yml}", exclude = ["**/node_modules/**", "**/dist/**"] } = options;
  // Doctor keys the results it keeps between runs by each Rule's meta and
  // code, not by these options, so the meta's `version` holds them.
  const files = JSON.stringify([include, exclude]);

  // Every Rule reads the same results; the first one to run lints the files.
  const lintProject = async (ctx: RuleContext) => {
    const key = `tinyaml-lint:${ctx.project.root}:${files}`;
    let results = ctx.cache.get<LintedFile[]>(key);
    if (!results) {
      results = await lintFiles(ctx.fs.glob(include, { exclude }), (file) => ctx.fs.readText(file));
      // Doctor snapshots dependencies at set(), so all reads must finish first.
      ctx.cache.set(key, results);
    }
    return results;
  };

  const doctorRules = ids.map((id) =>
    createRule({
      meta: {
        id,
        title: rules[id].title,
        category: "correctness",
        severity: rules[id].severity,
        execution: "manifest",
        version: files,
      },
      create(ctx) {
        return {
          async onProjectEnd() {
            for (const { file, diagnostics: found } of await lintProject(ctx)) {
              for (const { rule, line, column, offset, message, fix } of found) {
                if (rule !== id) continue;
                ctx.report(
                  diagnostics.diagnostics[rules[id].code]!({
                    why: message,
                    fix,
                    sources: [`${file}:${line}:${column}`],
                  }),
                  { file, range: { start: offset, end: offset, line, column } },
                );
              }
            }
          },
        };
      },
    }),
  );

  return defineDoctorExtension({
    name: "tinyaml",
    rulePacks: [
      defineRulePack({
        name: "tinyaml",
        version: "1.0.0",
        rules: doctorRules,
        diagnostics,
        presets: { recommended: ids },
      }),
    ],
  });
}
