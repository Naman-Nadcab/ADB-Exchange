/**
 * Deterministic MOCK execution + fill-policy capability resolution.
 * UI must not offer modes/policies this resolver rejects.
 */
import { getForexCustomerCapabilityContract } from './customer-contract.js';
import type { ForexCustomerOrderType } from '../orders/request.js';
import type { ForexTimeInForce } from '../orders/request.js';

export type ForexExecutionModeCapability = 'MOCK';
export type ForexFillPolicyCapability = 'FOK' | 'IOC';
export type ForexNormalizedExecutionMode = 'MOCK' | 'INTERNAL' | 'INSTANT' | 'REQUEST' | 'MARKET' | 'EXCHANGE';

export type ForexResolvedExecutionCapabilities = {
  source: 'SIMULATED';
  activeExecutionMode: ForexExecutionModeCapability;
  realForex: false;
  /** Modes the architecture understands; only MOCK is active while REAL_FOREX is off. */
  executionModes: Array<{
    id: ForexNormalizedExecutionMode;
    customerSelectable: boolean;
    engineActive: boolean;
    note: string;
  }>;
  fillPolicies: Array<{
    id: ForexFillPolicyCapability | 'RETURN' | 'BOC';
    customerSelectable: boolean;
    engineActive: boolean;
    note: string;
  }>;
  orderKinds: readonly ForexCustomerOrderType[];
  allowedSides: readonly ('buy' | 'sell')[];
  timeInForce: readonly ForexTimeInForce[];
};

export function resolveForexExecutionCapabilities(): ForexResolvedExecutionCapabilities {
  const contract = getForexCustomerCapabilityContract();
  return {
    source: 'SIMULATED',
    activeExecutionMode: 'MOCK',
    realForex: false,
    executionModes: [
      { id: 'MOCK', customerSelectable: true, engineActive: true, note: 'Simulated fills at executable quote' },
      { id: 'INTERNAL', customerSelectable: false, engineActive: false, note: 'REAL_FOREX off' },
      { id: 'INSTANT', customerSelectable: false, engineActive: false, note: 'Provider adapter not configured' },
      { id: 'REQUEST', customerSelectable: false, engineActive: false, note: 'Provider adapter not configured' },
      { id: 'MARKET', customerSelectable: false, engineActive: false, note: 'LP market execution not configured' },
      { id: 'EXCHANGE', customerSelectable: false, engineActive: false, note: 'Exchange execution not configured' },
    ],
    fillPolicies: [
      { id: 'FOK', customerSelectable: contract.timeInForce.fok.customerExposed, engineActive: contract.timeInForce.fok.engine, note: 'Market-only' },
      { id: 'IOC', customerSelectable: contract.timeInForce.ioc.customerExposed, engineActive: contract.timeInForce.ioc.engine, note: 'Market-only' },
      { id: 'RETURN', customerSelectable: true, engineActive: true, note: 'Partial remainder rests. A market remainder becomes a limit at the fill price.' },
      { id: 'BOC', customerSelectable: true, engineActive: true, note: 'Rejects a market order or a limit that would take liquidity.' },
    ],
    orderKinds: contract.customer.orderTypes,
    allowedSides: ['buy', 'sell'],
    timeInForce: contract.customer.timeInForce,
  };
}
