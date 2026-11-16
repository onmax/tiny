// linkify-it 5.0.2 as published, and the same code with uc.micro's `P` swapped
// for the engine's (scripts/uc-engine.ts): every module of the second copy
// carries `?engine` in its URL, so the two don't share state.
import { registerHooks } from "node:module";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const engine = new URL("./uc-engine.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!context.parentURL?.endsWith("?engine")) return nextResolve(specifier, context);
    if (specifier === "uc.micro") return { url: engine, shortCircuit: true };
    const resolved = nextResolve(specifier, context);
    return { ...resolved, url: `${resolved.url}?engine` };
  },
});

const file = pathToFileURL(realpathSync("node_modules/linkify-it/index.mjs")).href;
export const published = (await import(file)).default;
export const onEngine = (await import(`${file}?engine`)).default;
export { changed } from "./uc-engine.ts";
