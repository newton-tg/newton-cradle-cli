import { Address, OpenedContract, TonClient, WalletContractV4, internal, toNano } from "@ton/ton";
// import { DEX, pTON } from "@ston-fi/sdk";
import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import { DEX } from "@/contracts/dex";
import { pTON } from "./contracts/pTON";
import { PoolV1 } from "./contracts/dex/v1/PoolV1";
import { JettonWallet as TonJettonWallet } from "@ton/ton";
import { JettonWallet } from "./contracts/core/JettonWallet";
import { JettonMinter } from "./contracts/core/JettonMinter";

import * as readline from 'readline/promises';
import { AddressType } from "./types";
import { d, l } from "vitest/dist/index-81973d31";
import { parse } from "path";
import { PtonV1 } from "./contracts/pTON/v1/PtonV1";
import { PtonV2_1 } from "./contracts/pTON/v2_1/PtonV2_1";

import dotenv from "dotenv";
dotenv.config();

const deployConfigEnv = ".env";
let myMnemonic;
let apiKey;
if (!process.env.MY_MNEMONIC) {
  console.log(` - ERROR: No MY_MNEMONIC env variable found, please add it to env`);
  process.exit(1);
} else {
  myMnemonic = process.env.MY_MNEMONIC;
}

if (myMnemonic === undefined) {
  console.log(` - ERROR: No MY_MNEMONIC env variable found, please add it to env`);
  process.exit(1);
}

if (!process.env.API_KEY) {
  console.log(` - ERROR: No API_KEY env variable found, please add it to env`);
  process.exit(1);
} else {
  apiKey = process.env.API_KEY;
}

const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  apiKey
});


const routerAddress = "EQAsxiBVZ5ys4KVMwbOtWDij8cjhflAOoti52oyBnW8mbtk0";

const JETTON1 = "EQAe6ZRu9D7zhSyxoHpG_E7I0ihpqtsACknv17nHCICmD4Xm";

const router = client.open(new DEX.v1.Router(routerAddress));

const workchain = 0;


const newQueryId = async (wallet: OpenedContract<WalletContractV4>): Promise<number> => {
  return 12345;
}

interface PoolParams {
    token0: AddressType;
    token1: AddressType;
    decimals0: number;
    decimals1: number;
    ampCoeff: number;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const formatJettons = (tokens: number, decimals: number): bigint => {
    return BigInt(tokens * 10 ** decimals);
}

const parseJettons = (jettons: bigint, decimals: number): number => {
    return Number(jettons) / 10 ** decimals;
}

const formatToken = (address: AddressType): AddressType => {
  if (address.toString() == PtonV1.address.toString()) {
    return "TON";
  }
  return address;
}

const describePool = async (poolAddress: OpenedContract<PoolV1>, poolParams: PoolParams) => {
    const poolData = await poolAddress.getPoolData();
    const poolType = `${poolData.ampCoeff === 0 ? 'Constant Product' : 'Stable Swap'} pool ${poolData.ampCoeff === 0 ? '' : `with amplification coefficient ${poolData.ampCoeff}`}`;
    const jettonWallet0 = client.open(JettonWallet.create(poolData.token0WalletAddress));
    const jettonMaster0 = (await jettonWallet0.getWalletData()).jettonMasterAddress;
    const jettonWallet1 = client.open(JettonWallet.create(poolData.token1WalletAddress));
    const jettonMaster1 = (await jettonWallet1.getWalletData()).jettonMasterAddress;

    const reserve0 = parseJettons(poolData.reserve0, poolParams.decimals0);
    const reserve1 = parseJettons(poolData.reserve1, poolParams.decimals1);
    const description = `${poolType} has reserves of ${reserve0} ${formatToken(jettonMaster0)} and ${reserve1} ${formatToken(jettonMaster1)}`;
    console.log(description);
}

const describeUser = async (pool: OpenedContract<PoolV1>, poolParams: PoolParams, userAddress: AddressType, wallet: OpenedContract<WalletContractV4>): Promise<{token0: number, token1: number, lp: bigint, ton: number}> => {
    const formatToken = (address: AddressType): AddressType => {
      if (address == PtonV1.address) {
        return "wrapped TON";
      }
      return address;
    }
    const tonBalance = parseJettons(await wallet.getBalance(), 9);
    console.log(`You have ${tonBalance} TON`);

    let jettonWallet0Balance = 0;
    if (poolParams.token0 != PtonV1.address) {
      try {
          const jettonWallet0 = client.open(JettonWallet.create(await client.open(JettonMinter.create(poolParams.token0)).getWalletAddress(userAddress)));
          jettonWallet0Balance = parseJettons((await jettonWallet0.getWalletData()).balance, poolParams.decimals0);
      } catch (e) {
        jettonWallet0Balance = 0;
      }
      console.log(`You have ${jettonWallet0Balance} ${formatToken(poolParams.token0)}`);
    } else {
      jettonWallet0Balance = tonBalance;
    }
    let jettonWallet1Balance = 0;
    if (poolParams.token1 != PtonV1.address) {
      try {
          const jettonWallet1 = client.open(JettonWallet.create(await client.open(JettonMinter.create(poolParams.token1)).getWalletAddress(userAddress)));
          jettonWallet1Balance = parseJettons((await jettonWallet1.getWalletData()).balance, poolParams.decimals1);
      } catch (e) {
        jettonWallet1Balance = 0;
      }
      console.log(`You have ${jettonWallet1Balance} ${formatToken(poolParams.token1)}`);
    } else {
      jettonWallet1Balance = tonBalance;
    }
    let lp;
    try {
      // const initialLpWallet = client.open(await pool.getInitialLiquidityJettonWallet());
      const lpWallet = client.open(await pool.getJettonWallet({
          ownerAddress: userAddress,
      }));
      const lpBalance = await lpWallet.getWalletData();
      lp = lpBalance.balance;
    } catch (e) {
      lp = BigInt(0);
    }

    console.log("You have ", lp, " LP tokens");
    return { token0: jettonWallet0Balance, token1: jettonWallet1Balance, lp: lp, ton: tonBalance };
}

const handleProvideLiquidity = async (keyPair: KeyPair, contract: OpenedContract<WalletContractV4>,
  poolParams: PoolParams, myAddress: AddressType, userBalance: {
    token0: number,
    token1: number}, poolExists: boolean) => {
    if (!poolExists) {
      console.log('You are providing initial liquidity to the pool so you will not be able to withdraw it');
    }
    const token0AmountAnswer = await rl.question(`How many ${formatToken(poolParams.token0)} do you want to provide? `);
    const token1AmountAnswer = await rl.question(`How many ${formatToken(poolParams.token1)} do you want to provide? `);
    if (isNaN(Number(token0AmountAnswer)) || isNaN(Number(token1AmountAnswer))) {
      console.log('Invalid input');
      return;
    }
    const token0Amount = formatJettons(Number(token0AmountAnswer), poolParams.decimals0);
    const token1Amount = formatJettons(Number(token1AmountAnswer), poolParams.decimals1);

    if (Number(token0AmountAnswer) > userBalance.token0 || Number(token1AmountAnswer) > userBalance.token1) {
      console.log('Insufficient balance');
      return;
    }

    const queryId = await newQueryId(contract);

    let firstTx;
    if (poolParams.token0 == PtonV1.address) {
      firstTx = router.getProvideLiquidityTonTxParams(
        {
          userWalletAddress: myAddress,
          proxyTon: new pTON.v1(),
          sendAmount: token0Amount,
          otherTokenAddress: poolParams.token1,
          minLpOut: "1",
          ampCoeff: poolParams.ampCoeff,
          queryId,
        }
      );
    } else {
      firstTx = router.getProvideLiquidityJettonTxParams({
        userWalletAddress: myAddress,
        sendTokenAddress: poolParams.token0,
        sendAmount: token0Amount,
        otherTokenAddress: poolParams.token1,
        minLpOut: "1",
        ampCoeff: poolParams.ampCoeff,
        queryId,
      });
    }

    let secondTx;
    if (poolParams.token1 == PtonV1.address) {
      secondTx = router.getProvideLiquidityTonTxParams(
        {
          userWalletAddress: myAddress,
          proxyTon: new pTON.v1(),
          sendAmount: token1Amount,
          otherTokenAddress: poolParams.token0,
          minLpOut: "1",
          ampCoeff: poolParams.ampCoeff,
          queryId,
        }
      );
    } else {
      secondTx = router.getProvideLiquidityJettonTxParams({
        userWalletAddress: myAddress,
        sendTokenAddress: poolParams.token1,
        sendAmount: token1Amount,
        otherTokenAddress: poolParams.token0,
        minLpOut: "1",
        ampCoeff: poolParams.ampCoeff,
        queryId,
      });
    }

    const txsParams = await Promise.all([ firstTx, secondTx]);
    console.log(`Depositing${poolExists ? '' : ' initial'} ${token0AmountAnswer} ${formatToken(poolParams.token0)} and ${token1AmountAnswer} ${formatToken(poolParams.token1)}`);
        await contract.sendTransfer({
      seqno: await contract.getSeqno(),
      secretKey: keyPair.secretKey,
      messages: [internal(txsParams[0]), internal(txsParams[1])]
    });

}

const handleWithdrawLiquidity = async (pool: OpenedContract<PoolV1>, poolParams: PoolParams, userBalance: 
  {token0: number, token1: number, lp: bigint},
  keyPair: KeyPair, contract: OpenedContract<WalletContractV4>) => {
    const lpToBurnAns = await rl.question('How many LP tokens do you want to burn? ');
    // throw if not integer
    if (!Number.isInteger(Number(lpToBurnAns))) {
      console.log('Invalid input');
      return;
    }
    const lpToBurn = BigInt(lpToBurnAns);
    if (lpToBurn > userBalance.lp) {
      console.log('Insufficient LP balance');
      return;
    }
    const txParams = await pool.getBurnTxParams({
        amount: lpToBurn,
        responseAddress: contract.address,
        queryId: await newQueryId(contract),
      });
    await contract.sendTransfer({
    seqno: await contract.getSeqno(),
    secretKey: keyPair.secretKey,
    messages: [internal(txParams)],
    });

}

const handleSwap = async (keyPair: KeyPair, contract: OpenedContract<WalletContractV4>, poolParams: PoolParams, pool: OpenedContract<PoolV1>) => {
    // const pool = client.open(await router.getPool(poolParams));
    const tokenAnswer = await rl.question(
      'Swap token1 for token0 (0), or token0 for token1 (1): ');
    var tokenOut, tokenIn, decimalsOut, decimalsIn, tokenOutName, tokenInName;
    switch (tokenAnswer) {
      case '0':
        tokenOut = poolParams.token1;
        tokenIn = poolParams.token0;
        tokenOutName = formatToken(tokenOut);
        tokenInName = formatToken(tokenIn);
        decimalsOut = poolParams.decimals1;
        decimalsIn = poolParams.decimals0;
        break;
      case '1':
        tokenOut = poolParams.token0;
        tokenIn = poolParams.token1;
        tokenOutName = formatToken(tokenOut);
        tokenInName = formatToken(tokenIn);
        decimalsOut = poolParams.decimals0;
        decimalsIn = poolParams.decimals1;
        break;
      default:
        console.log('Invalid input');
        return;
    }
    const amountOutAnswer = await rl.question(
      `How many ${tokenOutName} do you want to swap? `);
    if (isNaN(Number(amountOutAnswer))) {
      console.log('Invalid input');
      return;
    }
    const amountOut = formatJettons(Number(amountOutAnswer), decimalsOut);
    const amountInAnswer = await rl.question(
      `How many ${tokenInName} do you want to receive? `);
    if (isNaN(Number(amountInAnswer))) {
      console.log('Invalid input');
      return;
    }
    const amountIn = formatJettons(Number(amountInAnswer), decimalsIn);

    let swapTxParams;

    if (tokenOut == PtonV1.address) {
      swapTxParams = await router.getSwapTonToJettonTxParams({
        userWalletAddress: contract.address,
        proxyTon: new pTON.v1(),
        offerAmount: amountOut,
        askJettonAddress: tokenIn,
        minAskAmount: amountIn,
        ampCoeff: poolParams.ampCoeff,
        queryId: await newQueryId(contract),
      });
    } else if (tokenIn == PtonV1.address) {
      swapTxParams = await router.getSwapJettonToTonTxParams({
        userWalletAddress: contract.address,
        proxyTon: new pTON.v1(),
        offerJettonAddress: tokenOut,
        offerAmount: amountOut,
        minAskAmount: amountIn,
        ampCoeff: poolParams.ampCoeff,
        queryId: await newQueryId(contract),
      });
    } else {
      swapTxParams = await router.getSwapJettonToJettonTxParams({
          userWalletAddress: contract.address,
          offerJettonAddress: tokenOut,
          offerAmount: amountOut,
          askJettonAddress: tokenIn,
          minAskAmount: amountIn,
          ampCoeff: poolParams.ampCoeff,
          queryId: await newQueryId(contract),
      });
    }

    await contract.sendTransfer({
    seqno: await contract.getSeqno(),
    secretKey: keyPair.secretKey,
    messages: [internal(swapTxParams)],
    });
}

const run = async () => {
    const keyPair = await mnemonicToPrivateKey(myMnemonic.split(' '));

    const wallet = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
      });
    console.log("wallet", wallet.address);
    const contract = client.open(wallet);

    var jetton0 = await rl.question(`Enter token0 address or "TON": (default: TON) `);
    if (jetton0 === '') {
      jetton0 = PtonV1.address.toString();
    }
    let decimals0 = 9;
    if (jetton0 != PtonV1.address.toString()) {
      var decimals0Ans = await rl.question(`Enter decimals0: (default: 9) `);
      if (decimals0Ans === '') {
        decimals0Ans = '9';
      }
      decimals0 = Number(decimals0Ans);
    }

    // should be between 1 and 18
    if (!Number.isInteger(decimals0) || (decimals0 < 1 || decimals0 > 18)) {
      console.log('Invalid input');
      return;
    }

    var jetton1 = await rl.question(`Enter token1: (default: ${JETTON1}) `);
    if (jetton1 === '') {
      jetton1 = JETTON1;
    }
    if (jetton1 === "TON") {
      jetton1 = PtonV1.address.toString();
    }
    let decimals1 = 9;
    if (jetton1 != PtonV1.address.toString()) {
      var decimals1Ans = await rl.question(`Enter decimals1: (default: 9) `);
      if (decimals1Ans === '') {
        decimals1Ans = '9';
      }
      decimals1 = Number(decimals1Ans);
    }
    // should be between 1 and 18
    if (!Number.isInteger(decimals1) || (decimals1 < 1 || decimals1 > 18)) {
      console.log('Invalid input');
      return;
    }

    if (jetton0 === jetton1) {
      console.log('Tokens must be different');
      return;
    }

    const poolType = await rl.question('Stable swap (ss) or constant product (cp) pool? (default: ss)');
    var ampCoeff = 0;
    if (poolType === 'ss' || poolType === '') {
      let ampCoeffAnswer = await rl.question('Enter the stable swap amplification coefficient (1-255):  (default: 100)');
      if (ampCoeffAnswer === '') {
        ampCoeffAnswer = '100';
      }
      ampCoeff = Number(ampCoeffAnswer);
      // check for integer and within bounds
      if (!Number.isInteger(ampCoeff) || (ampCoeff < 1 || ampCoeff > 255)) {
        console.log('Invalid input');
        return;
      }
    } else if (poolType === 'cp') {
      // do nothing
    } else {
      console.log('Invalid input');
      return;
    }

    const poolParams = {
      token0: jetton0,
      token1: jetton1,
      decimals0,
      decimals1,
      ampCoeff
    }; 


    const pool = client.open(await router.getPool({
      token0: jetton0,
      token1: jetton1,
      ampCoeff
    }));

    let poolExists = true;
    const userBalance = await describeUser(pool, poolParams, contract.address, contract);
    try {
      await describePool(pool, poolParams);
    } catch (e) {
      console.log('Pool does not exist');
      poolExists = false;
    }

    const action = await rl.question('Provide liquidity (0), swap tokens (1), withdraw liquidity (2), or exit (3)? ');
    switch (action) {
      case '0':
        await handleProvideLiquidity(keyPair, contract, poolParams, contract.address, userBalance, poolExists);
        break;
      case '1':
        if (!poolExists) {
          console.log('Pool does not exist, cannot swap');
          return;
        }
        await handleSwap(keyPair, contract, poolParams, pool);
        break;
      case '2':
        if (!poolExists) {
          console.log('Pool does not exist, cannot withdraw liquidity');
          return;
        }
        await handleWithdrawLiquidity(pool, poolParams, userBalance, keyPair, contract);
        break;
      case '3':
        return;
      default:
        console.log('Invalid input');
        return;
    }
};

run().then(() => {
    console.log('done');
    process.exit(0);
});