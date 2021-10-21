import { BigNumber, ethers } from "ethers";
import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  getJsonRpcUrl,
} from "forta-agent";
import { COMPTROLLER_ABI, COMPTROLLER_ADDRESS, CTOKEN_ABI } from "./utils";

const provideHandleBlock = () => {
  const exchangeRates: { [addr: string]: BigNumber } = {};

  const provider = new ethers.providers.JsonRpcProvider(getJsonRpcUrl());
  const comptroller = new ethers.Contract(
    COMPTROLLER_ADDRESS,
    COMPTROLLER_ABI,
    provider
  );

  return async (blockEvent: BlockEvent) => {
    const findings: Finding[] = [];

    const ctokenAddrs: [string] = await comptroller.getAllMarkets({
      blockTag: blockEvent.blockNumber,
    });
    const ctokens = ctokenAddrs.map(
      (addr) => new ethers.Contract(addr, CTOKEN_ABI, provider)
    );
    for (const ctoken of ctokens) {
      const name: string = await ctoken.name({
        blockTag: blockEvent.blockNumber,
      });
      const currRate: BigNumber = await ctoken.exchangeRateCurrent({
        blockTag: blockEvent.blockNumber,
      });
      const prevRate = exchangeRates[ctoken.address];
      if (prevRate && currRate.lt(prevRate)) {
        findings.push(
          Finding.fromObject({
            name: "cToken Exchange Rate went down",
            description: `cToken ${name} Exchange Rate went down.`,
            alertId: "COMPOUND_CTOKEN_EXRATE",
            severity: FindingSeverity.Medium,
            type: FindingType.Info,
          })
        );
      }
      exchangeRates[ctoken.address] = currRate;
    }
    return findings;
  };
};

export default {
  handleBlock: provideHandleBlock(),
};
