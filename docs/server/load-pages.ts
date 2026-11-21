// The pages render in dev and while prerendering. The Worker serves every page from its prerendered files, so its
// bundle leaves the renderer and the Markdown out, and a path nothing prerendered finds nothing here. A route that
// only prerenders, like llms.txt, uses the `.prerender` suffix and imports server/pages.ts directly instead.
export const loadPages = () =>
  import.meta.dev || import.meta.prerender ? import("./pages.ts") : undefined;
