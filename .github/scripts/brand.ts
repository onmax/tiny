// Draws the family's brand from one mark, the 🤏 emoji: the logo, the favicons,
// the icons a phone and a shared link show, and a banner for the root and each
// package. The banners' numbers come from .github/drop-ins.json, so they match
// the drop-in tables; run `pnpm drop-ins` first to measure again.
// Usage: node --no-warnings .github/scripts/brand.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import { kib, readDropIns, times } from "../../automd.config.ts";

// 🤏 as Twemoji draws it (github.com/jdecked/twemoji, CC-BY 4.0), as paths
// rather than text, so it looks the same on every system and in every PNG.
// Its own two colors are the brand's: the hand and the crease.
const YELLOW = "#ffdc5d";
const AMBER = "#ef9645";
const pinch = `<path fill="${YELLOW}" d="M33.29 8.628C33.265 8.62 24.499 6 21.499 5c-1.2-.4-21-7-21 16 0 .637 2 11 4 11h11c8.375 0 5.642-10.68 15.92-12.106 1.739-.241 2.621-1.112 2.466-2.566-.165-1.549-1.975-2.059-3.534-2.059-1.146 0-5.754.233-9.026 1.951-.286-1.809-.826-4.013-.826-6.221 5 1 11.092 2.333 11.209 2.372 1.31.434 2.726-.271 3.162-1.582.438-1.309-.27-2.724-1.58-3.161z"/><path fill="${AMBER}" d="M19.207 7.293c-.389-.391-1.023-.392-1.414-.001-.391.39-.392 1.023-.001 1.415.017.017 1.704 1.737 1.704 4.293v7.109c0 .852-.501 1.154-.97 1.154-.496 0-1.025-.332-1.025-1.264v-2c0-3.767-.303-7.77-2.553-8.895-.495-.247-1.095-.046-1.342.447-.247.494-.047 1.095.447 1.342.66.33 1.447 1.831 1.447 7.105v.996s-.004 1.001-.004 3.114c0 .852-.501 1.154-.97 1.154-.496 0-1.025-.332-1.025-1.264v-2c0-3.767-.303-7.77-2.553-8.895-.495-.248-1.095-.046-1.342.447-.247.494-.047 1.095.447 1.342.66.33 1.447 1.831 1.447 7.105v2c0 .021.005.039.005.06-.001.017-.01.032-.01.049 0 .852-.501 1.154-.97 1.154-.496.004-1.025-.328-1.025-1.26 0-3.394 0-7.618-2.553-8.895-.495-.248-1.095-.046-1.342.447-.247.494-.047 1.095.447 1.342C7.5 15.618 7.5 19.613 7.5 22c0 2.143 1.522 3.264 3.025 3.264.722 0 1.445-.263 1.999-.769.56.505 1.281.769 2.001.769 1.236 0 2.473-.769 2.846-2.232.368.151.761.232 1.154.232 1.476 0 2.97-1.083 2.97-3.154V13c0-3.375-2.194-5.613-2.288-5.707z"/>`;

// A warm near-black and three text tones on it, picked in oklch and written as
// hex, because librsvg, which renders the PNGs, doesn't read oklch().
const INK = "#110f0c"; // oklch(0.17 0.008 80)
const PAPER = "#f8f5ec"; // oklch(0.97 0.012 90), 17.6:1 on INK
const MUTED = "#b1aa9d"; // oklch(0.74 0.02 85), 8.3:1
const FAINT = "#868073"; // oklch(0.6 0.02 85), 4.9:1

const logo = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36" role="img" aria-labelledby="t">
<title id="t">tiny</title>
${pinch}
</svg>
`;

// The hand on INK, for places that need a square with no transparency: the
// iOS home screen, and the image a shared link shows.
const tile = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
<rect width="36" height="36" fill="${INK}"/>
<g transform="translate(6.3 7.2) scale(.65)">${pinch}</g>
</svg>
`;

type Stat = [value: string, label: string];
interface Banner {
  file: string;
  name: string;
  title: string;
  tagline: string;
  stats: Stat[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The name, a line, and three numbers on the left; on the right the hand,
// mirrored so its fingers pinch toward them, and its cut wrist below the edge.
const banner = (b: Banner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400" viewBox="0 0 1280 400" role="img" aria-labelledby="t">
<title id="t">${esc(b.title)}</title>
<clipPath id="frame"><rect width="1280" height="400" rx="24"/></clipPath>
<g clip-path="url(#frame)">
<rect width="1280" height="400" fill="${INK}"/>
<g transform="translate(1236 58) scale(-11 11)">${pinch}</g>
<g font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">
<text x="76" y="150" fill="${PAPER}" font-size="96" font-weight="700" letter-spacing="-4">${esc(b.name)}</text>
<text x="80" y="206" fill="${MUTED}" font-size="28">${esc(b.tagline)}</text>
${b.stats
  .map(([value, label], i) => {
    const x = 80 + i * 240;
    const v = esc(value).replace("×", `<tspan fill="${YELLOW}">×</tspan>`);
    return `<text x="${x}" y="306" fill="${PAPER}" font-size="56" font-weight="700" letter-spacing="-2">${v}</text>
<text x="${x}" y="342" fill="${FAINT}" font-size="20">${esc(label)}</text>`;
  })
  .join("\n")}
</g>
</g>
</svg>
`;

const { dropIns, root } = readDropIns();
const row = (library: string) => dropIns.find((r) => r.library === library)!;
const count = (pkg: string) => String(dropIns.filter((r) => r.package === pkg).length);
const dependencies = (pkg: string) =>
  String(
    Object.keys(JSON.parse(readFileSync(`packages/${pkg}/package.json`, "utf8")).dependencies ?? {})
      .length,
  );

const banners: Banner[] = [
  {
    file: ".github/assets/banner.svg",
    name: "tiny",
    title: "tiny: smaller, faster drop-ins for YAML, JSON5, JSONC and INI libraries",
    tagline: "Smaller, faster parsers. Same API.",
    stats: [
      [String(dropIns.length), "drop-in replacements"],
      [times(row("yaml").parse), "faster than yaml"],
      ["0", "dependencies"],
    ],
  },
  {
    file: "packages/tinyaml/.github/banner.svg",
    name: "tinyaml",
    title: "tinyaml: a smaller, faster drop-in for js-yaml 4 and 5, yaml, yamljs and @std/yaml",
    tagline: "Swap your YAML library for a smaller, faster one.",
    stats: [
      [`${kib(root.gzip.ours)} KiB`, "own API, gzipped"],
      [times(row("js-yaml 4").parse), "faster than js-yaml"],
      [count("tinyaml"), "drop-in replacements"],
    ],
  },
  {
    file: "packages/tinyjson5/.github/banner.svg",
    name: "tinyjson5",
    title:
      "tinyjson5: smaller, faster drop-ins for json5 2 and 1, strip-json-comments, jsonc-parser, comment-json and jju",
    tagline: "Faster drop-ins for JSON5 and JSONC parsers.",
    stats: [
      [times(row("json5 2.2.3").parse), "faster than json5"],
      [count("tinyjson5"), "drop-in replacements"],
      [dependencies("tinyjson5"), "dependencies"],
    ],
  },
  {
    file: "packages/tinyini/.github/banner.svg",
    name: "tinyini",
    title: "tinyini: faster drop-ins for ini 1 to 7 and @one-ini/wasm",
    tagline: "Swap ini for a faster one, at the same size.",
    stats: [
      [times(row("ini 7.0.0").parse), "faster than ini"],
      [times(row("ini 7.0.0").stringify!), "faster stringify"],
      [dependencies("tinyini"), "dependencies"],
    ],
  },
];

const write = (file: string, content: string | Buffer) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(file);
};
const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

// An .ico is a directory of images, and each may be a whole PNG.
const ico = (images: [size: number, png: Buffer][]) => {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(([size, data], i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(size, at);
    head.writeUInt8(size, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map(([, data]) => data)]);
};

write(".github/assets/logo.svg", logo(64));
write(".github/assets/favicon.svg", logo(32));
write(".github/assets/favicon-32.png", await png(logo(32)));
write(
  ".github/assets/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => [size, await png(logo(size))] as const))),
);
write(".github/assets/apple-touch-icon.png", await png(tile(180)));
write(".github/assets/logo-512.png", await png(tile(512)));
for (const b of banners) write(b.file, banner(b));
