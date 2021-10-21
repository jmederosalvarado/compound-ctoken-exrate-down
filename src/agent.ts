import { BigNumber, ethers } from "ethers";
import {
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

  return async () => {
    const findings: Finding[] = [];

    const ctokenAddrs: [string] = await comptroller.getAllMarkets();
    const ctokens = ctokenAddrs.map(
      (addr) => new ethers.Contract(addr, CTOKEN_ABI, provider)
    );
    for (const ctoken of ctokens) {
      const name: string = await ctoken.name();
      const currRate: BigNumber = await ctoken.exchangeRateCurrent();
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
