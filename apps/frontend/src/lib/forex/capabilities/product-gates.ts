/** Customer-facing Forex product gates — derived from server truth, never faked. */
export type ForexProductGates = {
  realForex: boolean;
  executionMode: string;
  source: string;
  liveAccountEnabled: boolean;
  realFundingEnabled: boolean;
  withdrawalEnabled: boolean;
  transferEnabled: boolean;
  paymentMethodsEnabled: boolean;
};

export const FOREX_PRODUCT_GATES_DEFAULT: ForexProductGates = {
  realForex: false,
  executionMode: 'MOCK',
  source: 'SIMULATED',
  liveAccountEnabled: false,
  realFundingEnabled: false,
  withdrawalEnabled: false,
  transferEnabled: false,
  paymentMethodsEnabled: false,
};

export function deriveForexProductGates(input: {
  realForex?: boolean;
  executionMode?: string;
  source?: string;
}): ForexProductGates {
  const realForex = input.realForex === true;
  return {
    realForex,
    executionMode: input.executionMode ?? 'MOCK',
    source: input.source ?? 'SIMULATED',
    liveAccountEnabled: realForex,
    realFundingEnabled: realForex,
    withdrawalEnabled: realForex,
    transferEnabled: realForex,
    paymentMethodsEnabled: realForex,
  };
}
