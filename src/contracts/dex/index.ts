import { DEX_VERSION } from "./constants";
import { DEX as DEXv1 } from "./v1";
import { DEX as DEXv2_1 } from "./v2_1";

export { DEX_VERSION, DEX_TYPE } from "./constants";

export const DEX = {
  [DEX_VERSION.v1]: DEXv1,
  [DEX_VERSION.v2_1]: DEXv2_1,
} as const;
