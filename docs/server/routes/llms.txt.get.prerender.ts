import { defineEventHandler } from "nuxt/server";
import { llms } from "../pages.ts";

// The `.prerender` suffix keeps this route in the prerender build only: the Worker serves the prerendered file and its
// bundle has no code for the route, so it can import the pages directly. `nuxi dev` doesn't serve it.
export default defineEventHandler(
  () => new Response(llms, { headers: { "content-type": "text/plain; charset=utf-8" } }),
);
