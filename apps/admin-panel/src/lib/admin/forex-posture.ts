/** Shared venue mode for Forex admin — avoids implying live broker when MOCK/simulated. */
export type ForexVenueMode = 'LIVE' | 'SIMULATED' | 'DEMO';

export function deriveForexVenueMode(posture?: {
  realForex?: boolean;
  executionMode?: string;
  source?: string;
}): { mode: ForexVenueMode; description: string } {
  if (posture?.realForex) {
    return { mode: 'LIVE', description: 'Live money path — external execution may apply' };
  }
  const exec = (posture?.executionMode ?? 'MOCK').toUpperCase();
  const src = (posture?.source ?? 'SIMULATED').toUpperCase();
  if (exec.includes('MOCK') || src.includes('SIM')) {
    return {
      mode: 'SIMULATED',
      description: 'Simulated venue — MOCK execution and quotes; not live brokerage liquidity',
    };
  }
  return { mode: 'DEMO', description: 'Demo / training environment — no real client money' };
}
