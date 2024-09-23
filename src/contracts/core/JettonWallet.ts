import type { ContractProvider } from "@ton/ton";

import { Contract } from "@/contracts/core/Contract";

export class JettonWallet extends Contract {
  async getBalance(provider: ContractProvider) {
    const state = await provider.getState();

    if (state.state.type !== "active") {
      return BigInt(0);
    }

    const { balance } = await this.getWalletData(provider);

    return balance;
  }

  async getWalletData(provider: ContractProvider) {
    const result = await provider.get("get_wallet_data", []);
    const balance = result.stack.readBigNumber();
    let ownerAddress; 
    try {
      ownerAddress = result.stack.readAddress();
    } catch (e) {
      // sometimes can be null
      ownerAddress = null;
    }

    return {
      balance,
      ownerAddress,
      jettonMasterAddress: result.stack.readAddress(),
      jettonWalletCode: result.stack.readCell(),
    };
  }
}
