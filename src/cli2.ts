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
const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  apiKey: "c01ce5368fe2e352ce698e7a3bebd09582f0cdf8e309cf8dea736a6e121d7e93"
});

// const client = new TonClient({
//     endpoint: "https://toncenter.com/api/v2/jsonRPC",
//   });

// const routerAddress = "EQCnlVfSrYe2Q-m__wTsNezeSesZ6Jw-iN1dYfuuuindJXwf";
const routerAddress = "EQAsxiBVZ5ys4KVMwbOtWDij8cjhflAOoti52oyBnW8mbtk0";

const myAddress = "0QAMUjN7e1W787PAnTLiV5Y7O-9qOp0Rf0g9Vw1tlU4Mw0RZ";


const JETTON0 = "EQAWWa8d2_vsIZ4CHA6TRiyWOmwMRIsA_CarQmSlgLi528OI";
const JETTON1 = "EQAe6ZRu9D7zhSyxoHpG_E7I0ihpqtsACknv17nHCICmD4Xm";
// const PTON_ADDR = "kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px";

const router = client.open(new DEX.v1.Router(routerAddress));
// const router = client.open(new DEX.v1.Router());

const workchain = 0;


const run = async () => {
    const mnemonics = "such alley define begin equal amount intact venue scan accuse inquiry zebra daughter satisfy cluster trust gas choice age regret chat hundred hat wink".split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonics);

    const wallet = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
      });
    console.log("wallet", wallet.address);
    const contract = client.open(wallet);

    const txParams = await client.open(await (new pTON.v1())).getDeployWalletTxParams({
        ownerAddress: routerAddress,
    });
    // await contract.sendTransfer({
    //     seqno: await contract.getSeqno(),
    //     secretKey: keyPair.secretKey,
    //     messages: [internal(txParams)],
    // });
    // return;
    

    const txsParams = await Promise.all([
        // deposit 0.5 STON to the STON/GEMSTON pool and get at least 1 nano LP token
        // router.getProvideLiquidityJettonTxParams({
        //   userWalletAddress: myAddress,
        //   sendTokenAddress: JETTON1,
        //   sendAmount: toNano("10.0"),
        //   otherTokenAddress: JETTON0,
        //   minLpOut: "1",
        //   ampCoeff: 0,
        //   queryId: 12345,
        // }),
        router.getProvideLiquidityTonTxParams({
          userWalletAddress: myAddress,
          proxyTon: new pTON.v1(),
          sendAmount: toNano("1.0"),
          otherTokenAddress: JETTON0,
          minLpOut: "1",
          ampCoeff: 0,
          queryId: 12345,
        }),
        // deposit 2 GEMSTON to the STON/GEMSTON pool and get at least 1 nano LP token
        router.getProvideLiquidityJettonTxParams({
          userWalletAddress: myAddress,
          sendTokenAddress: JETTON0,
          sendAmount: toNano("10.0"),
          otherTokenAddress: JETTON1,
          minLpOut: "1",
          ampCoeff: 0,
          queryId: 123456,
        }),
    ]);

    await contract.sendTransfer({
        seqno: await contract.getSeqno(),
        secretKey: keyPair.secretKey,
        messages: [internal(txsParams[0])],
    });
    console.log('sent 1st tx');

    // await contract.sendTransfer({
    //     seqno: await contract.getSeqno(),
    //     secretKey: keyPair.secretKey,
    //     messages: [internal(txsParams[1])],
    // });
    // console.log('sent 2nd tx');


};

run().then(() => {
    console.log('done');
    process.exit(0);
});