// @one-ini/wasm declares TokenTypes as an enum, which is a type as well as a
// value, and `editorconfig` 3 casts tokens to it. tsrs checks this file.
import { TokenTypes as Tokens, parse_to_uint32array } from "../../src/one-ini/index.ts";
import { TokenTypes as Tokens01 } from "../../src/one-ini-v0.1/index.ts";
import { same } from "./assert.ts";

same<Tokens, 0 | 1 | 2 | 3 | 4>(true);
same<Tokens01, 0 | 1 | 2 | 3 | 4>(true);

const parsed = parse_to_uint32array(new TextEncoder().encode("[*]\nindent_size = 2\n"));
switch (parsed[0] as Tokens) {
  case Tokens.Section:
  case Tokens.Key:
  case Tokens.Value:
    break;
}
