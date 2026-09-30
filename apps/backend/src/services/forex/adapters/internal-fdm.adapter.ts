import { forexMarketDataWorkerSnapshot } from '../market-data/worker.js';
import { forexReadinessSnapshot } from '../durability/ready.js';
import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';
import type { BrokerAdapter, BrokerAdapterHealth, ForexProviderType } from './types.js';

/** Wraps the in-repo Forex Dealing Module (MOCK/simulated execution path). */
export class InternalFdmBrokerAdapter implements BrokerAdapter {
  readonly adapterId = 'internal-fdm';
  readonly providerType: ForexProviderType = 'INTERNAL_FDM';

  async connect(): Promise<void> {
    /* In-process FDM is always on when the API worker is running. */
  }

  async disconnect(): Promise<void> {
    /* No-op — shutting down FDM is a platform control, not an adapter toggle. */
  }

  async healthCheck(): Promise<BrokerAdapterHealth> {
    const md = forexMarketDataWorkerSnapshot();
    const ready = forexReadinessSnapshot();
    const flags = effectiveForexRuntimeFlags();
    const checkedAt = new Date().toISOString();

    if (flags.killSwitch) {
      return {
        status: 'disabled',
        message: 'Forex kill switch is active',
        checkedAt,
      };
    }
    if (!ready.economicReady) {
      return {
        status: 'degraded',
        message: ready.reason ?? 'Forex economic state not ready',
        checkedAt,
      };
    }
    if (!md.running) {
      return {
        status: 'degraded',
        message: 'Quote worker is not running',
        checkedAt,
      };
    }

    return {
      status: 'connected',
      message: `Internal FDM · ${flags.executionMode} execution · ${md.symbols} symbols`,
      checkedAt,
      latencyMs: md.intervalMs,
    };
  }
}

let singleton: InternalFdmBrokerAdapter | null = null;

export function getInternalFdmBrokerAdapter(): InternalFdmBrokerAdapter {
  if (!singleton) singleton = new InternalFdmBrokerAdapter();
  return singleton;
}
