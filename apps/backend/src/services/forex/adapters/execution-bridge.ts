/**
 * S3 — optional pre-routing broker adapter gate (default off).
 * Does not change MOCK LP selection; only verifies the default broker adapter health.
 */
import { forexConfig } from '../config.js';
import type { ForexExecReason } from '../execution/states.js';
import { defaultBrokerAdapterId, getBrokerAdapterById } from './registry.js';

export async function assertBrokerAdapterReadyForExecution(): Promise<
  { ok: true; adapterId: string } | { ok: false; reason: ForexExecReason }
> {
  if (!forexConfig.adapterLayerHookEnabled) {
    return { ok: true, adapterId: defaultBrokerAdapterId() };
  }

  const adapterId = defaultBrokerAdapterId();
  const adapter = getBrokerAdapterById(adapterId);
  if (!adapter) {
    return { ok: false, reason: 'PROVIDER_INELIGIBLE' };
  }

  const health = await adapter.healthCheck();
  if (health.status === 'disabled') {
    return { ok: false, reason: 'INSTRUMENT_HALTED' };
  }
  if (health.status === 'disconnected' || health.status === 'not_configured') {
    return { ok: false, reason: 'PROVIDER_INELIGIBLE' };
  }

  return { ok: true, adapterId };
}
