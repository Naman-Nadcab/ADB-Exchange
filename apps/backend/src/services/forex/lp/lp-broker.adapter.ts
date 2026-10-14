import type { BrokerAdapter, BrokerAdapterHealth, ForexProviderType } from '../adapters/types.js';
import { lpApiConfigured, lpHealth } from './lp-api-client.js';

/** Catalog adapter for the external LP. HTTP stays in lp-api-client.ts. */
export class LpBrokerAdapter implements BrokerAdapter {
  readonly adapterId = 'direct-lp';
  readonly providerType: ForexProviderType = 'DIRECT_LP';

  async connect(): Promise<void> {
    const health = await this.healthCheck();
    if (health.status !== 'connected') {
      throw new Error(health.message);
    }
  }

  async disconnect(): Promise<void> {
    /* The LP session is HTTP per call. Nothing to close. */
  }

  async healthCheck(): Promise<BrokerAdapterHealth> {
    const checkedAt = new Date().toISOString();
    if (!lpApiConfigured()) {
      return { status: 'not_configured', message: 'FOREX_LP_BASE_URL is empty', checkedAt };
    }
    const health = await lpHealth();
    if (!health.connected) {
      return { status: 'disconnected', message: health.message, checkedAt, latencyMs: health.latencyMs };
    }
    return { status: 'connected', message: health.message, checkedAt, latencyMs: health.latencyMs };
  }
}

let singleton: LpBrokerAdapter | null = null;

export function getLpBrokerAdapter(): LpBrokerAdapter {
  if (!singleton) singleton = new LpBrokerAdapter();
  return singleton;
}
