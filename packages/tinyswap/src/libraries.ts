// The libraries tinyaml, tinyjson5, tinyini and tinylinkify replace, and which subpath
// replaces each version. The ranges are the ones each package's README lists
// under Switching: a version outside them has no drop-in, and stays.

export type Tiny = "tinyaml" | "tinyjson5" | "tinyini" | "tinylinkify";

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface Library {
  name: string;
  tiny: Tiny;
  /** The versions with a drop-in, for messages. */
  covers: string;
  /** The subpath that replaces this version, if one does. */
  pick(version: Version): string | undefined;
  /** Subpaths of the original whose exports the same drop-in has. */
  subpaths?: string[];
  /** The package with its types, which goes when the original does. */
  types?: string;
  /** The commands it installs, which the drop-ins have no equivalent of. */
  bins?: string[];
}

export const LIBRARIES: Library[] = [
  {
    name: "js-yaml",
    tiny: "tinyaml",
    covers: "4 and 5",
    pick: ({ major }) =>
      major === 4 ? "tinyaml/js-yaml" : major === 5 ? "tinyaml/js-yaml-v5" : undefined,
    types: "@types/js-yaml",
    bins: ["js-yaml"],
  },
  {
    name: "yaml",
    tiny: "tinyaml",
    covers: "2",
    pick: ({ major }) => (major === 2 ? "tinyaml/yaml" : undefined),
    bins: ["yaml"],
  },
  {
    name: "yamljs",
    tiny: "tinyaml",
    covers: "0.3",
    pick: ({ major, minor }) => (major === 0 && minor === 3 ? "tinyaml/yamljs" : undefined),
    types: "@types/yamljs",
    bins: ["yaml2json", "json2yaml"],
  },
  {
    name: "@std/yaml",
    tiny: "tinyaml",
    covers: "1",
    pick: ({ major }) => (major === 1 ? "tinyaml/std" : undefined),
    // tinyaml/std exports `parse` and `stringify`, each of which @std/yaml
    // also publishes on its own.
    subpaths: ["parse", "stringify"],
  },
  {
    name: "json5",
    tiny: "tinyjson5",
    covers: "1 and 2",
    pick: ({ major }) =>
      major === 2 ? "tinyjson5/json5" : major === 1 ? "tinyjson5/json5-v1" : undefined,
    types: "@types/json5",
    bins: ["json5"],
  },
  {
    name: "strip-json-comments",
    tiny: "tinyjson5",
    covers: "2, 3 and 5",
    pick: ({ major }) =>
      major === 2
        ? "tinyjson5/strip-json-comments-v2"
        : major === 3
          ? "tinyjson5/strip-json-comments"
          : major === 5
            ? "tinyjson5/strip-json-comments-v5"
            : undefined,
    types: "@types/strip-json-comments",
  },
  {
    name: "jsonc-parser",
    tiny: "tinyjson5",
    covers: "3",
    pick: ({ major }) => (major === 3 ? "tinyjson5/jsonc-parser" : undefined),
  },
  {
    name: "comment-json",
    tiny: "tinyjson5",
    covers: "4",
    pick: ({ major }) => (major === 4 ? "tinyjson5/comment-json" : undefined),
  },
  {
    name: "jju",
    tiny: "tinyjson5",
    covers: "1",
    pick: ({ major }) => (major === 1 ? "tinyjson5/jju" : undefined),
  },
  {
    name: "ini",
    tiny: "tinyini",
    covers: "1 to 7",
    // 2.0.0 to 4.0.0 behave the same, and 4.1.0 changed how whitespace-only
    // lines and section headers read. 4.1.0 to 4.1.2 differ from tinyini/ini
    // only by bugs 4.1.3 fixed.
    pick: ({ major, minor }) =>
      major === 1
        ? "tinyini/ini-v1"
        : major === 2 || major === 3 || (major === 4 && minor === 0)
          ? "tinyini/ini-v2"
          : major >= 4 && major <= 7
            ? "tinyini/ini"
            : undefined,
    types: "@types/ini",
  },
  {
    name: "@one-ini/wasm",
    tiny: "tinyini",
    covers: "0.1 and 0.2",
    pick: ({ major, minor }) =>
      major !== 0
        ? undefined
        : minor === 2
          ? "tinyini/one-ini"
          : minor === 1
            ? "tinyini/one-ini-v0.1"
            : undefined,
  },
  {
    name: "linkify-it",
    tiny: "tinylinkify",
    covers: "4 and 5",
    // tinylinkify/linkify-it follows 5.0.2. 4.0.1 and 5.0.0 behave the same,
    // and differ from it only where 5.0.1 reworked the search for its DoS fix.
    pick: ({ major }) => (major === 4 || major === 5 ? "tinylinkify/linkify-it" : undefined),
    types: "@types/linkify-it",
  },
];

export const byName = new Map(LIBRARIES.map((library) => [library.name, library]));

/**
 * The value exports of each drop-in, so an import of a name it leaves out,
 * such as yaml's `parseAllDocuments`, stays. test/libraries.test.ts checks
 * them against the packages' sources.
 */
const names = (text: string) => text.split(" ");

export const EXPORTS: Record<string, string[]> = {
  "tinyaml/js-yaml": names(
    "CORE_SCHEMA DEFAULT_SCHEMA FAILSAFE_SCHEMA JSON_SCHEMA Schema Type YAMLException default " +
      "dump load loadAll safeDump safeLoad safeLoadAll types",
  ),
  "tinyaml/js-yaml-v5": names(
    "COLLECTION_STYLE COLLECTION_STYLE_BLOCK COLLECTION_STYLE_FLOW CORE_SCHEMA " +
      "DEFAULT_SCALAR_STYLE_RULES DUMP_SCHEMA FAILSAFE_SCHEMA JSON_SCHEMA NOT_RESOLVED " +
      "SCALAR_STYLE SCALAR_STYLE_DOUBLE_QUOTED SCALAR_STYLE_FOLDED_BLOCK " +
      "SCALAR_STYLE_LITERAL_BLOCK SCALAR_STYLE_PLAIN SCALAR_STYLE_SINGLE_QUOTED Schema " +
      "YAML11_SCHEMA YAMLException binaryTag boolCoreTag boolJsonTag boolYaml11Tag " +
      "defineMappingTag defineScalarTag defineSequenceTag dump floatCoreTag floatJsonTag " +
      "floatYaml11Tag intCoreTag intJsonTag intYaml11Tag legacyMapTag load loadAll mapTag " +
      "mergeTag nullCoreTag nullJsonTag nullYaml11Tag omapTag pairsTag realMapTag seqTag setTag " +
      "strTag timestampTag",
  ),
  "tinyaml/yaml": names("YAMLError YAMLParseError YAMLWarning default parse stringify"),
  "tinyaml/yamljs": names(
    "DumpException ParseException default dump load parse parseFile stringify",
  ),
  "tinyaml/std": names("YamlSyntaxError parse parseAll stringify"),
  "tinyjson5/json5": names("default parse stringify"),
  "tinyjson5/json5-v1": names("default parse stringify"),
  "tinyjson5/strip-json-comments": names("default"),
  "tinyjson5/strip-json-comments-v2": names("default"),
  "tinyjson5/strip-json-comments-v5": names("default"),
  "tinyjson5/jsonc-parser": names(
    "ParseErrorCode ScanError SyntaxKind applyEdits createScanner findNodeAtLocation " +
      "findNodeAtOffset format getLocation getNodePath getNodeValue modify parse parseTree " +
      "printParseErrorCode stripComments visit",
  ),
  "tinyjson5/comment-json": names(
    "CommentArray PREFIX_AFTER PREFIX_AFTER_ALL PREFIX_AFTER_COLON PREFIX_AFTER_PROP " +
      "PREFIX_AFTER_VALUE PREFIX_BEFORE PREFIX_BEFORE_ALL assign moveComments parse " +
      "removeComments stringify tokenize",
  ),
  "tinyjson5/jju": names("analyze parse stringify tokenize update"),
  "tinyini/ini": names("decode default encode parse safe stringify unsafe"),
  "tinyini/ini-v2": names("decode default encode parse safe stringify unsafe"),
  "tinyini/ini-v1": names("decode default encode parse safe stringify unsafe"),
  "tinyini/one-ini": names("TokenTypes default parse_to_json parse_to_uint32array version"),
  "tinyini/one-ini-v0.1": names("TokenTypes default parse_to_json parse_to_uint32array version"),
  // `module.exports` makes require() return the constructor, as linkify-it's does.
  "tinylinkify/linkify-it": names("default module.exports"),
};

/** The library a module specifier imports, and the subpath after its name. */
export function libraryOf(specifier: string): { library: Library; subpath: string } | undefined {
  for (const library of LIBRARIES) {
    if (specifier === library.name) return { library, subpath: "" };
    if (specifier.startsWith(`${library.name}/`))
      return { library, subpath: specifier.slice(library.name.length + 1) };
  }
  return undefined;
}

/** The first version in a version or range: "^4.1.0" and "4.x" read as 4.1.0 and 4.0.0. */
export function parseVersion(text: string): Version | undefined {
  const match = /(?:^|[^\w.])v?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?/.exec(text);
  if (!match) return undefined;
  const number = (part: string | undefined) => (part && /^\d+$/.test(part) ? Number(part) : 0);
  return { major: number(match[1]), minor: number(match[2]), patch: number(match[3]) };
}

/**
 * The drop-in for every version a range allows, or `null` if they'd get
 * different ones or the range is one this can't bound. "^4.1.0" allows 4.1.0
 * to 4.x, so for ini it gives tinyini/ini, and "^4.0.0" gives null.
 */
export function pickRange(library: Library, range: string): string | undefined | null {
  const targets = new Set<string | undefined>();
  for (const alternative of range.replace(/^npm:(?:@?[^@]+@)?|^jsr:/, "").split("||")) {
    const bounds = boundsOf(alternative.trim());
    if (!bounds) return null;
    for (const version of bounds) targets.add(library.pick(version));
  }
  return targets.size === 1 ? [...targets][0] : null;
}

const ANY = Number.MAX_SAFE_INTEGER;

// The lowest and highest version a range allows, for a range of one
// comparator, or of `>=a <b`.
function boundsOf(range: string): [Version, Version] | undefined {
  const parts = range.split(/\s+/);
  if (parts.length === 2 && parts[0]!.startsWith(">=") && parts[1]!.startsWith("<")) {
    const low = partsOf(parts[0]!.slice(2));
    const inclusive = parts[1]!.startsWith("<=");
    const high = partsOf(parts[1]!.slice(inclusive ? 2 : 1));
    if (low?.major === undefined || high?.major === undefined) return undefined;
    const { major, minor = 0, patch = 0 } = high;
    const below = inclusive
      ? { major, minor: high.minor ?? ANY, patch: high.patch ?? ANY }
      : patch > 0
        ? { major, minor, patch: patch - 1 }
        : minor > 0
          ? { major, minor: minor - 1, patch: ANY }
          : { major: major - 1, minor: ANY, patch: ANY };
    return [{ major: low.major, minor: low.minor ?? 0, patch: low.patch ?? 0 }, below];
  }
  const match = parts.length === 1 && /^(\^|~|=)?(.*)$/.exec(parts[0]!);
  const version = match ? partsOf(match[2]!) : undefined;
  if (!match || version?.major === undefined) return undefined;
  const { major, minor, patch } = version;
  const low = { major, minor: minor ?? 0, patch: patch ?? 0 };
  // A missing part, or an x, allows any value there.
  let high = { major, minor: minor ?? ANY, patch: patch ?? ANY };
  if (match[1] === "~") high = { major, minor: minor ?? ANY, patch: ANY };
  if (match[1] === "^" && major > 0) high = { major, minor: ANY, patch: ANY };
  else if (match[1] === "^" && minor) high = { major, minor, patch: ANY };
  return [low, high];
}
// "4.1.0", "4.x" and "4" as their numbers, with an x or a missing part as
// undefined. A prerelease, which semver orders apart, reads as none.
// "4.1.0", "4.x" and "4" as their numbers, with an x or a missing part as undefined.
function partsOf(text: string) {
  const match = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:\+[\w.-]*)?$/.exec(text);
  if (!match) return undefined;
  const [major, minor, patch] = [match[1], match[2], match[3]].map((part) =>
    part === undefined || !/^\d+$/.test(part) ? undefined : Number(part),
  );
  return { major, minor, patch };
}
