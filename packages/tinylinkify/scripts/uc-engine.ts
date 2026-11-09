// uc.micro 2.1.0's classes, with `P` swapped for the engine's `\p{P}`, built
// here one code point at a time, apart from tinylinkify's own code. linkify-it
// loaded with this in place of uc.micro (scripts/originals.ts) is linkify-it
// on the engine's Unicode version, which tinylinkify/linkify-it must match on
// every input.
import { Any, Cc, Z, P as published } from "uc.micro";

const hex = (code: number) => `\\u${code.toString(16).padStart(4, "0")}`;
const bmp: string[] = [];
const astral = new Map<number, string[]>();
for (let code = 0; code <= 0x10ffff; code++) {
  if (code >= 0xd800 && code <= 0xdfff) continue;
  const char = String.fromCodePoint(code);
  if (!/\p{P}/u.test(char)) continue;
  if (code < 0x10000) bmp.push(hex(code));
  else {
    const high = char.charCodeAt(0);
    astral.set(high, [...(astral.get(high) ?? []), hex(char.charCodeAt(1))]);
  }
}
const P = new RegExp(
  [`[${bmp.join("")}]`, ...[...astral].map(([high, lows]) => `${hex(high)}[${lows.join("")}]`)].join(
    "|",
  ),
);

/** Code points whose punctuation class differs between uc.micro and the engine. */
export const changed: string[] = [];
const whole = (re: RegExp) => new RegExp(`^(?:${re.source})$`);
const [ours, theirs] = [whole(P), whole(published)];
for (let code = 0; code <= 0x10ffff; code++) {
  const char = String.fromCodePoint(code);
  if (ours.test(char) !== theirs.test(char)) changed.push(char);
}

export { Any, Cc, Z, P };
