// tinylinkify's own API: the GFM autolink literals in plain text, as
// remark-gfm and GitHub link them.
import { find as findAll, type Link } from "./core/gfm.ts";

export type { Link };

/** Every link in `text`: `www.` and `http(s)://` URLs, emails, and `mailto:` and `xmpp:` addresses. */
export const find = (text: string): Link[] => findAll(text);

/** Whether `text` has a link. */
export const test = (text: string): boolean => findAll(text, true, true, true).length > 0;
