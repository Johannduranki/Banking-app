import { config } from "../../config.js";
import type { CoreBankingProvider } from "./core-banking-provider.js";
import { FlexcubeAdapter } from "./flexcube-adapter.js";
import { MockFlexcubeAdapter } from "./mock-flexcube-adapter.js";

export function createCoreBankingProvider(provider=config.CORE_BANKING_PROVIDER):CoreBankingProvider {
  switch(provider){case "mock":return new MockFlexcubeAdapter();case "flexcube":return new FlexcubeAdapter();default:throw new Error(`Unsupported core banking provider: ${String(provider)}`);}
}

/** The only provider instance consumed by digital-banking application services. */
export const coreBankingProvider=createCoreBankingProvider();
