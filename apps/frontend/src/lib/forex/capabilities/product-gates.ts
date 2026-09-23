/** Customer-facing Forex product gates — derived from server truth, never faked. */
export type ForexProductGates = {
  realForex: boolean;
  executionMode: string;
  source: string;
  liveAccountEnabled: boolean;
  liveApplicationEnabled: boolean;
  realFundingEnabled: boolean;
  withdrawalEnabled: boolean;
  transferEnabled: boolean;
  internalTransferEnabled: boolean;
  paymentMethodsEnabled: boolean;
  liveForexReady: boolean;
  blockers: string[];
};

export const FOREX_PRODUCT_GATES_DEFAULT: ForexProductGates = {
  realForex: false,
  executionMode: 'MOCK',
  source: 'SIMULATED',
  liveAccountEnabled: false,
  liveApplicationEnabled: false,
  realFundingEnabled: false,
  withdrawalEnabled: false,
  transferEnabled: false,
  internalTransferEnabled: false,
  paymentMethodsEnabled: false,
  liveForexReady: false,
  blockers: [],
};

export function deriveForexProductGates(input: {
  realForex?: boolean;
  executionMode?: string;
  source?: string;
  readiness?: {
    liveForexReady?: boolean;
    blockers?: string[];
    capabilities?: {
      liveAccountApplication?: boolean;
      liveAccountProvisioning?: boolean;
      deposit?: boolean;
      withdrawal?: boolean;
      internalTransfer?: boolean;
      paymentMethods?: boolean;
    };
  };
}): ForexProductGates {
  const realForex = input.realForex === true;
  const caps = input.readiness?.capabilities;
  return {
    realForex,
    executionMode: input.executionMode ?? 'MOCK',
    source: input.source ?? 'SIMULATED',
    liveAccountEnabled: caps?.liveAccountProvisioning === true,
    liveApplicationEnabled: caps?.liveAccountApplication === true,
    realFundingEnabled: caps?.deposit === true,
    withdrawalEnabled: caps?.withdrawal === true,
    transferEnabled: caps?.internalTransfer === true || caps?.deposit === true,
    internalTransferEnabled: caps?.internalTransfer === true,
    paymentMethodsEnabled: caps?.paymentMethods === true,
    liveForexReady: input.readiness?.liveForexReady === true,
    blockers: input.readiness?.blockers ?? [],
  };
}
