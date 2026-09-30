/**
 * Canonical Forex customer capability model.
 *
 * Separates:
 * - engine: backend accepts / executes
 * - customerExposed: trading-config + UI may offer
 * - runtimeCertification: whether browser/live journey is certified (conservative default)
 *
 * GTD uses server-side expireAt evaluation (orders/service.ts expireGtdOrders).
 */
import type { ForexCustomerOrderType } from '../orders/request.js';
import type { ForexTimeInForce } from '../orders/request.js';

export type ForexRuntimeCertification = 'NOT_CERTIFIED' | 'MOCK_ONLY';

export type ForexCapabilityTriState = {
  engine: boolean;
  customerExposed: boolean;
  runtimeCertification: ForexRuntimeCertification;
};

export type ForexCustomerCapabilityContract = {
  version: 1;
  executionMode: 'MOCK';
  source: 'SIMULATED';
  realForex: false;
  orderTypes: {
    market: ForexCapabilityTriState;
    limit: ForexCapabilityTriState;
    stop: ForexCapabilityTriState;
    stopLimit: ForexCapabilityTriState;
  };
  timeInForce: {
    gtc: ForexCapabilityTriState;
    day: ForexCapabilityTriState;
    ioc: ForexCapabilityTriState;
    fok: ForexCapabilityTriState;
    gtd: ForexCapabilityTriState;
  };
  positionModes: {
    netting: ForexCapabilityTriState;
    hedging: ForexCapabilityTriState;
  };
  protections: {
    sl: ForexCapabilityTriState;
    tp: ForexCapabilityTriState;
    trailing: ForexCapabilityTriState;
  };
  positionActions: {
    close: ForexCapabilityTriState;
    partialClose: ForexCapabilityTriState;
    closeBy: ForexCapabilityTriState;
    reverse: ForexCapabilityTriState;
  };
  /** Flat lists derived from the model — customer-facing advertisement only. */
  customer: {
    orderTypes: ForexCustomerOrderType[];
    timeInForce: ForexTimeInForce[];
  };
  /** Engine acceptance (validateForexOrderRequest) — not necessarily exposed. */
  engine: {
    orderTypes: ForexCustomerOrderType[];
    timeInForce: ForexTimeInForce[];
  };
};

const MOCK_ONLY: ForexRuntimeCertification = 'MOCK_ONLY';
const NOT_CERTIFIED: ForexRuntimeCertification = 'NOT_CERTIFIED';

function tri(engine: boolean, customer: boolean, cert: ForexRuntimeCertification = NOT_CERTIFIED): ForexCapabilityTriState {
  return { engine, customerExposed: customer, runtimeCertification: cert };
}

/** Customer ticket / trading-config advertisement (Phase 2: stop_limit + full implemented TIF). */
export const FOREX_CUSTOMER_EXPOSED_ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit'] as const satisfies readonly ForexCustomerOrderType[];
export const FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE = ['GTC', 'IOC', 'FOK', 'DAY', 'GTD'] as const satisfies readonly ForexTimeInForce[];

/** Backward-compatible alias used by admin config exports. */
export const FOREX_CUSTOMER_ORDER_TYPES = FOREX_CUSTOMER_EXPOSED_ORDER_TYPES;

export const FOREX_ENGINE_ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit'] as const satisfies readonly ForexCustomerOrderType[];
export const FOREX_ENGINE_TIME_IN_FORCE = ['GTC', 'IOC', 'FOK', 'DAY', 'GTD'] as const satisfies readonly ForexTimeInForce[];

export function getForexCustomerCapabilityContract(): ForexCustomerCapabilityContract {
  const orderEngine = true;
  const orderCustomer = (t: (typeof FOREX_CUSTOMER_EXPOSED_ORDER_TYPES)[number]) =>
    (FOREX_CUSTOMER_EXPOSED_ORDER_TYPES as readonly string[]).includes(t);

  return {
    version: 1,
    executionMode: 'MOCK',
    source: 'SIMULATED',
    realForex: false,
    orderTypes: {
      market: tri(orderEngine, orderCustomer('market'), MOCK_ONLY),
      limit: tri(orderEngine, orderCustomer('limit'), MOCK_ONLY),
      stop: tri(orderEngine, orderCustomer('stop'), MOCK_ONLY),
      stopLimit: tri(orderEngine, orderCustomer('stop_limit'), MOCK_ONLY),
    },
    timeInForce: {
      gtc: tri(true, true, MOCK_ONLY),
      day: tri(true, true, MOCK_ONLY),
      ioc: tri(true, true, MOCK_ONLY),
      fok: tri(true, true, MOCK_ONLY),
      gtd: tri(true, true, MOCK_ONLY),
    },
    positionModes: {
      netting: tri(true, true, MOCK_ONLY),
      hedging: tri(true, true, MOCK_ONLY),
    },
    protections: {
      sl: tri(true, true, NOT_CERTIFIED),
      tp: tri(true, true, NOT_CERTIFIED),
      trailing: tri(true, true, MOCK_ONLY),
    },
    positionActions: {
      close: tri(true, true, NOT_CERTIFIED),
      partialClose: tri(true, true, NOT_CERTIFIED),
      closeBy: tri(true, true, MOCK_ONLY),
      reverse: tri(true, false, NOT_CERTIFIED),
    },
    customer: {
      orderTypes: [...FOREX_CUSTOMER_EXPOSED_ORDER_TYPES],
      timeInForce: [...FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE],
    },
    engine: {
      orderTypes: [...FOREX_ENGINE_ORDER_TYPES],
      timeInForce: [...FOREX_ENGINE_TIME_IN_FORCE],
    },
  };
}
