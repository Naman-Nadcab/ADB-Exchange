/** Verified Forex WS channels only. Do not invent names. */

export const FOREX_PUBLIC_CHANNELS = ['fx.quote.*', 'fx.liquidity.*'] as const;

export const FOREX_PRIVATE_CHANNELS = [
  'fx.order',
  'fx.fill',
  'fx.execution',
  'fx.position',
  'fx.margin',
  'fx.risk',
  'fx.account',
  'fx.balance',
  'fx.pnl',
  'fx.equity',
  'fx.funding',
  'fx.protection',
  'fx.liquidation',
  'fx.exposure',
  'fx.dealing',
  'fx.restriction',
] as const;

export type ForexWsEnvelope = {
  type: string;
  channel?: string;
  data?: unknown;
  timestamp?: number;
};
