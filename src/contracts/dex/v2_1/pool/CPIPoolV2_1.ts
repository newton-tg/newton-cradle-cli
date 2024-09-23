import type { ContractProvider } from "@ton/ton";

import { DEX_TYPE } from "@/contracts/dex/constants";

import { BasePoolV2_1 } from "./BasePoolV2_1";

export class CPIPoolV2_1 extends BasePoolV2_1 {
  public static readonly dexType = DEX_TYPE.CPI;

  public async getPoolData(provider: ContractProvider) {
    const data = await this.implGetPoolData(provider);

    return {
      ...data.commonPoolData,
    };
  }
}
