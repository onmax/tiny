// Loaded with `node --import`, for linkify-it's own tests copied into
// test/suites: points their `../index.mjs`, and the `require("../")` of its
// CommonJS test, at the modules in REDIRECT_TARGET and REDIRECT_REQUIRE (file
// URLs), so the tests run unchanged against tinylinkify or linkify-it itself.
import { registerHooks } from "node:module";

const target = process.env.REDIRECT_TARGET!;
const required = process.env.REDIRECT_REQUIRE ?? target;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/test/suites/")) {
      if (specifier === "../index.mjs") return { url: target, shortCircuit: true };
      if (specifier === "../") return { url: required, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
