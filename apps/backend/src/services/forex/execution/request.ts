import type { ForexExecSide } from './venue.js';

export type ForexOrderType = 'market' | 'limit';

export interface ForexExecutionRequest {
  clientExecId: string;
  symbol: string;
  side: ForexExecSide;
  volume: string;
  orderType: ForexOrderType;
  requestedPrice?: string;
  maxSlippage?: string;
  maxDeviation?: string;
  accountId?: string;
  timestamp: string;
}

export function executionFingerprint(req: ForexExecutionRequest): string {
  return [req.symbol, req.side, req.volume, req.orderType, req.requestedPrice ?? ''].join('|');
}
