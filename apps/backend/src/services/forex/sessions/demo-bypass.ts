/**
 * When customer DEMO funding is enabled and REAL_FOREX is off, MOCK demo accounts
 * may open new exposure outside the FX 24x5 calendar (practice trading).
 * Live / REAL_FOREX paths must not use this bypass.
 */
import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';

export function isForexDemoMockSessionBypassActive(): boolean {
  const flags = effectiveForexRuntimeFlags();
  return flags.demoFundingEnabled && flags.realForex === false && flags.executionMode === 'MOCK';
}
