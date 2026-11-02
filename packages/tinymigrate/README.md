# tinymigrate

Moves a project to the [tinyaml](../tinyaml), [tinyjson5](../tinyjson5) and [tinyini](../tinyini) drop-ins. It finds which of the libraries they replace your package.json files depend on, picks the subpath for the version you have installed, rewrites the imports, and swaps the dependencies.

```sh
npx tinymigrate [dir]
```

`dir` defaults to the current directory. tinymigrate isn't on npm until the first release. Until then, clone this repository, run `pnpm install` and `pnpm build`, and run `node packages/tinymigrate/dist/cli.mjs`.

## What it does

1. Reads every package.json in the project that git doesn't ignore, workspace packages included, and lists the libraries below in `dependencies`, `devDependencies` and `optionalDependencies`. It leaves `peerDependencies` alone, and a library that is also a peer dependency, since the package's users install it.
2. Finds the version of each: the one in `node_modules`, then the one in the lockfile (pnpm, npm, yarn or bun), then the range in package.json, if every version it allows gets the same drop-in. A version with no drop-in, or a range it can't decide, is listed and left alone.
3. Asks which libraries to move, all of them ticked to start with.
4. Shows each import it will change and each package.json edit, and asks before writing.
5. Rewrites the imports and package.json files, then offers to run your package manager's install.

| You use               | It imports                                                 |
| --------------------- | ---------------------------------------------------------- |
| js-yaml 4             | `tinyaml/js-yaml`                                          |
| js-yaml 5             | `tinyaml/js-yaml-v5`                                       |
| yaml 2                | `tinyaml/yaml`                                             |
| yamljs 0.3            | `tinyaml/yamljs`                                           |
| @std/yaml 1           | `tinyaml/std`, also for `@std/yaml/parse` and `/stringify` |
| json5 2               | `tinyjson5/json5`                                          |
| json5 1               | `tinyjson5/json5-v1`                                       |
| strip-json-comments 2 | `tinyjson5/strip-json-comments-v2`                         |
| strip-json-comments 3 | `tinyjson5/strip-json-comments`                            |
| strip-json-comments 5 | `tinyjson5/strip-json-comments-v5`                         |
| jsonc-parser 3        | `tinyjson5/jsonc-parser`                                   |
| comment-json 4        | `tinyjson5/comment-json`                                   |
| jju 1                 | `tinyjson5/jju`                                            |
| ini 1                 | `tinyini/ini-v1`                                           |
| ini 2, 3 and 4.0      | `tinyini/ini-v2`                                           |
| ini 4.1 to 7          | `tinyini/ini`                                              |
| @one-ini/wasm 0.2     | `tinyini/one-ini`                                          |
| @one-ini/wasm 0.1     | `tinyini/one-ini-v0.1`                                     |

Each package's README lists the exact versions its drop-ins are tested against, and where they still differ.

### Imports

It reads `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx` files, and the `<script>` blocks of `.vue`, `.svelte` and `.astro` files along with an `.astro` file's frontmatter. It skips `node_modules`, `dist` and whatever git ignores. Each file is parsed with [oxc-parser](https://www.npmjs.com/package/oxc-parser), so only real imports change, never a string in a comment or a template that looks like one. These forms move:

```ts
import yaml from "js-yaml";
import type { LoadOptions } from "js-yaml";
export * from "js-yaml";
await import("js-yaml");
require("js-yaml");
require.resolve("js-yaml");
import yaml = require("js-yaml");
type Yaml = typeof import("js-yaml");
vi.mock("js-yaml"); // and jest.mock, vi.importActual, jest.requireActual, ...
```

Only the text between the quotes changes, so quotes, spacing and comments stay as they were.

Some imports are reported and left as they are:

- A subpath the drop-in has no equivalent for, such as `yaml/util` or `js-yaml/dist/js-yaml.mjs`.
- A name the drop-in doesn't export, such as `import { parseDocument } from "yaml"` or `import jju from "jju"`. tinymigrate checks the names an `import`, an `export … from`, a destructured `require()` or a `require().name` reads. It can't check what code does with a namespace import or a whole `require()` result, nor type-only imports.
- A `require()` of a drop-in whose only export is its default, such as strip-json-comments: `require()` of an ES module gives `{ default }`, where the original gave the function.
- A `vi.mock` or `jest.mock` of a library when another import of it in the same file stays.

The original then stays in package.json too, so those imports still resolve. So does an original whose command a package.json script runs, such as `json5` or `js-yaml`, since the drop-ins have no command-line tools. A file the parser can't read is reported and left as it is, and so are the originals it may import.

In a workspace, an import takes the version of the nearest package.json above it that depends on the library.

### package.json

Each library moved is removed, along with its `@types` package if there is one, and the tiny package is added to the same field. When one tiny package replaces libraries in different fields, it goes in the first of `dependencies`, `optionalDependencies` and `devDependencies`. If the tiny package is already there, its range stays. The file keeps its indentation and line endings, and a new key goes where it sorts if the keys were sorted.

The range added is the version of tinymigrate that ran, since tinyaml, tinyjson5, tinyini and tinymigrate are released together at one version.

## Options

| Option           | What it does                                                                       |
| ---------------- | ---------------------------------------------------------------------------------- |
| `--yes`, `-y`    | Move every library found without asking. Doesn't run install.                      |
| `--dry-run`      | Print the changes as a diff and write nothing.                                     |
| `--only <names>` | Move only these libraries, a comma-separated list: `--only js-yaml,ini`.           |
| `--force`        | Write even if the git tree has uncommitted changes, or there is no git repository. |
| `--help`, `-h`   | Print the usage.                                                                   |

tinymigrate won't write to a project with uncommitted changes, so `git diff` shows exactly what it did and `git checkout .` undoes it. Without a terminal it needs `--yes` or `--dry-run`.

## API

The CLI's steps are exported too:

```ts
import { apply, plan, scan } from "tinymigrate";

const project = scan("."); // package.json files, source files, and the libraries found
const changes = plan(project, ["js-yaml"], {
  tinyaml: "^1.0.0",
  tinyjson5: "^1.0.0",
  tinyini: "^1.0.0",
});
apply(".", changes); // writes changes.edits and changes.manifests
```

## License

[MIT](./LICENSE)
