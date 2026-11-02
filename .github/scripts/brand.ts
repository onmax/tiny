// Draws the family's brand from one mark, the 🤏 emoji: the logo, the favicons,
// the icons a phone and a shared link show, and a banner for the root and each
// package. The banners' numbers come from .github/drop-ins.json, so they match
// the drop-in tables; run `pnpm drop-ins` first to measure again.
// Usage: node --no-warnings .github/scripts/brand.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import { kib, readDropIns, times } from "../../automd.config.ts";

// 🤏 as Noto Emoji draws it (github.com/googlefonts/noto-emoji, Apache 2.0), as
// paths rather than text, so it looks the same on every system and in every PNG.
// Its own colors are the brand's: the hand, its shade, and the crease. The shade
// and the crease are clipped to the hand.
const YELLOW = "#ffca28";
const AMBER = "#faa700";
const BROWN = "#b55e19";
const hand = "M47.3,65.5c-0.7-1.2-1.4-3-1.8-4.8c-0.4-1.4-1.6-7.3-2-8.9c-0.4-1.7-1.3-7,5.1-10.9c-1.2-2.1-6.5-1.6-9.1-0.7C33,42.5,25.1,46.5,16.7,45c-4.5-0.8-8.2-5.8-3.5-10.3c2.3-2.2,6.1-3.6,9.8-5.5c4-2,7-3.9,10.7-5.2c4.1-1.4,9.6-3.4,17.9-4.7c2-0.3,4,0.4,4.9,0.7c0.9,0.3,12.7,4.9,12.7,4.9s7.8-3.7,14.2,1.2c2.7,2,4.9,2.1,6,2.2c2.9,0.1,6.1,1.4,8,3.4c2,2,3.8,2.9,6.1,3.6c2.3,0.7,8.4,1.4,9.9,9.7c0.7,3.6,0.3,4.5,0.5,7.4c0.3,2.9,1,11.1,2,22.6c0.2,1.9,0.5,4.3,1.7,6.9s2.7,5.6,3.2,6.4s0.6,2.1-0.3,3.2c-4.5,6.4-20.7,20.8-31.6,23.5c-1.7,0.4-2.5-0.7-2.9-1.1c-0.5-0.4-2.4-3-6.8-4.5c-8.3-0.8-22.1-2.1-35.6-18c-3.9-4.6-7.4-12.2-15.2-17c-8.9-5.4-13.8-9.6-15.2-11.1c-2.9-3.1-2.7-9.8,2.4-11.8c2-0.8,13.5-1.6,23,6.8C43.5,62.4,42.7,63.3,47.3,65.5z";
const pinch = `<clipPath id="hand"><path d="${hand}"/></clipPath><path fill="${YELLOW}" d="${hand}"/><g clip-path="url(#hand)"><path fill="${AMBER}" d="M14.9,45.7c3.1,1.3,3.8-2.2,2.5-2.4c-2-0.3-5.1-3.5-2.5-6.6c1.8-2.1,7-3.8,10.4-5.4c4.2-2,6.4-4.1,10.3-5.2c2.8-0.8,11.5-3.2,13.1-3.6c2.5-0.6,4.3-1.2,7.3,0c1.9,0.7,4.4,1.9,5.1,2.2c0.7,0.3,1.4,1.1,0.7,1.9c-1.9,2.1-2.6,3.8-7.5,3.8s-12,1.2-19.6,6.9c-3.7,2.8-10.5,6.5-11.6,7c-1.1,0.6-0.9,1.9,0.3,1.6c1.2-0.2,17.8-2.3,18-2.3c0.2,0,23-13.1,25.1-14.6c4.7-3.3,9.7-4.7,14.4-1.8c2.3,1.4,4.8,3.3,8.9,3.4c6.7,0.1,6.2,4.6,10.6,6c4,1.2,8.9,1.9,10.7,7.2c1,2.8,2,7.9,2.7,19.3c3.7,0,4.8,0,4.8,0l-1.4-23.9L83.4,17.4l-33.2-2.6L5.7,33.5L10,46.1L14.9,45.7zM15.6,63.1c-1.9-2-2.5-6.2-0.3-7.4c4,3.4,16.8,3.2,21.3,2.1s1.6-4,1.6-4S19.6,45,10,51.1s-0.2,13.2,1.3,14.2S15.6,63.1,15.6,63.1zM97.9,59.1c1-1,1.4-1.3,2-1.6s2.7-0.8,2.5,1.9c-0.2,2.6-0.5,7.2-0.5,8.2s-0.5,3.6-3.5,2.5c-0.1-2.8,0.1-5.9-1.9-6.9S97.9,59.1,97.9,59.1zM88,74.2c-1-0.6-1.8-1.4-1.8-3.4s0.1-7.6,0-9.1c-0.1-1.6-0.2-3.3-2.1-4.1s-3-1.2-3.8-1.4s-2.7-0.5-3,1.6s-2.6,1.3-2.7,0.1c-0.2-1.3-0.7-4.1-3.8-5.1s-4.7-1.4-5.9-1.8c-1.3-0.4-5.1-0.5-5.1,2.9c0,3.1-2.5,1.6-2.6,0.2c-0.1-1.4-0.8-4.7-3.2-5.6c-3.1-1.1-5.5-1.7-6.9-2c-1.4-0.4-4,0-3.8,2.9c0.3,4.2,1.1,11.6,2.4,13.8s2,4.7,4.4,5.4s7.6,0.2,9.3,1.1c1.7,1,6.5,7.8,11.3,8.2c4.8,0.4,9.1-1.1,11.2-2.3c2.1-1.2,4.7-0.4,5.6-0.2C88.3,75.4,88,74.2,88,74.2z"/><path fill="${BROWN}" d="M115,47.2c-1,0.7-2.3,0.7-2.3,4.7s1,20.8,1.2,22.6s0.5,5.4,1.8,8.2c1.2,2.8,5.7,11.6,5.7,11.6l3.7-3.3L115,47.2zM10.1,58.3c1.4-0.2,2.8,0.1,3.5,1.7c1.6,3.4,8.1,6.3,19.6,14.5c3.1,2.1,5.6,5.9,7.7,10C47.5,97,56.6,104.8,74.6,106c10.5,0.7,12.8,0.8,14.1,2.3c1.1,1.3,0.7,3.2-1,3.6s-9-0.4-9-0.4S62.4,110,59,109.3c-3.4-0.8-38.1-23.5-43.2-33.6s-7-13.1-7.6-14.5C7.6,59.8,10.1,58.3,10.1,58.3zM48.7,40.9c1.3-0.7,17.7-11.7,18.5-12.2c1.2-0.8,0-2.6-1.4-1.8c-1.1,0.6-13.9,8.5-16.6,10.3c-12.4-1.9-15.8,5-27.9,6.3c-1.5,0.2-2.6,0-3.4-0.3c-0.8-0.2-2.6-0.5-3.5,1.2c-1,1.7,4.4,3.3,8.6,3C27.1,47.3,46.8,42,48.7,40.9zM14.3,51.2c0.6,0.9,1.3,2.4,4.8,2.4c5.3,0,14.3,1.2,21,10c3,4,8.2,6.7,12.6,6.9c4.5,0.3,7.2-0.2,9.6,3.2c4.7,6.6,12,7,19.3,2.9c0.4-0.2,0.8-0.3,1.3-0.3c3.8,0.2,16,0.3,16.8-7.6c0.2-2.2,0.1-3.9-1.6-5.7c-0.3-0.4-0.3-0.9,0.1-1.3c0.7-0.7,1.3-1.2,1.6-1.6c0.4-0.6,0.4-2.6-1.8-1.8c-1.2,0.4-4.3,2-6.4,0.7c-0.4-0.2-0.9-0.4-0.9,0.2s-0.1,1.8-0.1,2.1s-0.2,0.8,0.6,1c1.7,0.5,6.2,1.4,6,5.8c-0.2,3.5-3,5-12.7,5c-1.2,0-2.5-0.2-3.6-1.3c-0.6-0.6-1.6-1.5-2-1.9s-1-1.3-1.1-2.8s-0.3-7.9-0.3-9.3c-0.1-2,0.3-3.8,1.6-5c5.8-5.7,10.7-8.3,16.8-11.9c1.7-1,0.4-3-1.5-2.1C92,40,83,44.5,76.4,51.1c-1.5,1.5-2,3.3-2.1,4.8c-0.2,1.4,0.1,9.9,0.1,10.9s0.5,3.2,1.9,4.8c0.7,0.8,1.2,1.2,1.6,1.4c0.9,0.6,1.2,1.8,0.1,2.2c-1.9,0.8-7.8,2.8-12.9-1.7c-1.8-1.5-2.9-3.8-3.4-6.1s-1.4-8.9-1.6-14.9c-0.1-2.2,0.7-4.6,2.2-5.8C69.7,40.6,80.5,34.1,84,32c1.2-0.7,0-2.2-1.1-1.6c-4.6,2.1-16.1,8.7-22.6,14c-1.4,1.1-3.4,3.3-3.3,7.2c0.1,3.6,0.2,9.8,0.4,12.3c0.1,1.4-0.6,2.6-1.4,2.8c-1.5,0.3-3.8,0.2-5.6-0.7c-2-1-4.9-4.7-7-11.8c-0.8-2.8-12.4-5.4-15.5-5.6s-14.2-1.4-14.1,0S14.3,51.2,14.3,51.2z"/></g>`;

// A warm near-black and three text tones on it, picked in oklch and written as
// hex, because librsvg, which renders the PNGs, doesn't read oklch().
const INK = "#110f0c"; // oklch(0.17 0.008 80)
const PAPER = "#f8f5ec"; // oklch(0.97 0.012 90), 17.6:1 on INK
const MUTED = "#b1aa9d"; // oklch(0.74 0.02 85), 8.3:1
const FAINT = "#868073"; // oklch(0.6 0.02 85), 4.9:1

const logo = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128" role="img" aria-labelledby="t">
<title id="t">tiny</title>
${pinch}
</svg>
`;

// The hand on INK, for places that need a square with no transparency: the
// iOS home screen, and the image a shared link shows.
const tile = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
<rect width="128" height="128" fill="${INK}"/>
<g transform="translate(17.6 18.6) scale(.72)">${pinch}</g>
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

// The name, a line, and three numbers on the left; on the right the whole hand,
// its fingers pinching toward them.
const banner = (b: Banner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400" viewBox="0 0 1280 400" role="img" aria-labelledby="t">
<title id="t">${esc(b.title)}</title>
<clipPath id="frame"><rect width="1280" height="400" rx="24"/></clipPath>
<g clip-path="url(#frame)">
<rect width="1280" height="400" fill="${INK}"/>
<g transform="translate(900 72) scale(2)">${pinch}</g>
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
