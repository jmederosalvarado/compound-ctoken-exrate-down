import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  getJsonRpcUrl,
  HandleBlock,
} from "forta-agent";
import LRUCache from "lru-cache";
import { COMPTROLLER_ABI, COMPTROLLER_ADDRESS, CTOKEN_ABI } from "./utils";

// this method assumes that handleBlock is run sequentially on blocks, it's not documented wether or not this is the way that agents are run. According to https://github.dev/forta-protocol/forta-agent-sdk/blob/eec16a9b1b1be697dbf124e11b3602fca839a6e0/cli/commands/run/run.live.ts#L17-L34, they are run asyncroniously on blocks. See the next method for an alternative stateless implementation.
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

    const ctokenAddrs: string[] = await comptroller.getAllMarkets({
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
            type: FindingType.Suspicious,
          })
        );
      }
      exchangeRates[ctoken.address] = currRate;
    }
    return findings;
  };
};

const exchangeRatesCache = new LRUCache<string, BigNumber>();
const getExchangeRate = async (
  ctoken: ethers.Contract,
  blockNumber: number
): Promise<BigNumber> => {
  const cacheKey = `${ctoken.address}-${blockNumber}`;
  const cached = exchangeRatesCache.get(cacheKey);
  if (cached) return cached;
  const exchangeRate = await ctoken.exchangeRateCurrent({
    blockTag: blockNumber,
  });
  exchangeRatesCache.set(cacheKey, exchangeRate);
  return exchangeRate;
};

// stateless version
const handleBlock: HandleBlock = async (blockEvent) => {
  const findings: Finding[] = [];

  const provider = new ethers.providers.JsonRpcProvider(getJsonRpcUrl());
  const comptroller = new ethers.Contract(
    COMPTROLLER_ADDRESS,
    COMPTROLLER_ABI,
    provider
  );
  const ctokenAddrs: string[] = await comptroller.getAllMarkets({
    blockTag: blockEvent.blockNumber,
  });
  const ctokens = ctokenAddrs.map(
    (addr) => new ethers.Contract(addr, CTOKEN_ABI, provider)
  );
  for (const ctoken of ctokens) {
    const name: string = await ctoken.name({
      blockTag: blockEvent.blockNumber,
    });
    const currRate: BigNumber = await getExchangeRate(
      ctoken,
      blockEvent.blockNumber
    );

    const prevRate = await getExchangeRate(ctoken, blockEvent.blockNumber - 1);
    if (currRate.gt(prevRate)) {
      findings.push(
        Finding.fromObject({
          name: "cToken Exchange Rate went down",
          description: `cToken ${name} Exchange Rate went down.`,
          alertId: "COMPOUND_CTOKEN_EXRATE",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
        })
      );
    }
  }
  return findings;
};

export default {
  handleBlock
};
