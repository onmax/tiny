// The libraries tinyaml, tinyjson5 and tinyini replace, and which subpath
// replaces each version. The ranges are the ones each package's README lists
// under Switching: a version outside them has no drop-in, and stays.

export type Tiny = "tinyaml" | "tinyjson5" | "tinyini";

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
}

export const LIBRARIES: Library[] = [
  {
    name: "js-yaml",
    tiny: "tinyaml",
    covers: "4 and 5",
    pick: ({ major }) =>
      major === 4 ? "tinyaml/js-yaml" : major === 5 ? "tinyaml/js-yaml-v5" : undefined,
    types: "@types/js-yaml",
  },
  {
    name: "yaml",
    tiny: "tinyaml",
    covers: "2",
    pick: ({ major }) => (major === 2 ? "tinyaml/yaml" : undefined),
  },
  {
    name: "yamljs",
    tiny: "tinyaml",
    covers: "0.3",
    pick: ({ major, minor }) => (major === 0 && minor === 3 ? "tinyaml/yamljs" : undefined),
    types: "@types/yamljs",
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
