// Fuzzes published linkify-it versions, each against the next, to find which
// behave the same and so which tinylinkify/linkify-it can stand in for. It
// installs them into .cache/versions the first time. Each pair sees the same
// inputs and setups as scripts/fuzz.ts. Differences are listed by setup, with
// the first examples.
// Usage: node scripts/versions.ts [inputs] [version,version,...]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mutate, pick, rng, run, SCHEMAS, seeds, SETUPS, int, type Make } from "./inputs.ts";
import { attempt, count, seeded, show } from "./shared.ts";

const VERSIONS = "3.0.3,4.0.1,5.0.0,5.0.1,5.0.2";
const iterations = count(2, 20000);
const versions = (process.argv[3] ?? VERSIONS).split(",");
rng.next = seeded(1);

const dir = ".cache/versions";
if (!versions.every((v) => existsSync(`${dir}/node_modules/linkify-it-${v}`))) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/package.json`, '{ "private": true }\n');
  const specs = VERSIONS.split(",").map((v) => `linkify-it-${v}@npm:linkify-it@${v}`);
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", ...specs], {
    cwd: dir,
    stdio: "inherit",
  });
}
const require = createRequire(new URL(`../${dir}/package.json`, import.meta.url));
const libs: Make[] = versions.map((v) => require(`linkify-it-${v}`));

const inputs = Array.from({ length: iterations }, () => {
  const text = pick(seeds);
  return rng.next() < 0.9 ? mutate(text) : text;
});

for (let i = 1; i < libs.length; i++) {
  const [a, b] = [libs[i - 1]!, libs[i]!];
  const differ = new Map<string, string[]>();
  for (const [name, setup] of SETUPS) {
    const [la, lb] = [attempt(() => setup(a)), attempt(() => setup(b))];
    if (!la.ok || !lb.ok) {
      if (JSON.stringify(la) !== JSON.stringify(lb)) differ.set(name, ["setup differs"]);
      continue;
    }
    for (const text of inputs) {
      const schema = pick(SCHEMAS);
      const pos = int(text.length + 2);
      const [ra, rb] = [la.value, lb.value].map((l) => JSON.stringify(run(l, text, schema, pos)));
      if (ra === rb) continue;
      const list = differ.get(name) ?? [];
      list.push(`${show(text)}\n      ${versions[i - 1]} ${ra}\n      ${versions[i]} ${rb}`);
      differ.set(name, list);
    }
  }
  console.log(`${versions[i - 1]} → ${versions[i]}: ${differ.size ? "differ" : "same"}`);
  for (const [name, list] of differ) {
    console.log(`  ${name}: ${list.length} of ${inputs.length} inputs`);
    for (const example of list.slice(0, Number(process.env.SHOW ?? 2)))
      console.log(`    ${example}`);
  }
}
