/**
 * Central terminology keys for future professional translation.
 * Keys are stable identifiers — not user-facing copy.
 */

export const FOREX_TERMINOLOGY = {
  bid: 'forex.terminology.bid',
  ask: 'forex.terminology.ask',
  spread: 'forex.terminology.spread',
  pip: 'forex.terminology.pip',
  lot: 'forex.terminology.lot',
  leverage: 'forex.terminology.leverage',
  margin: 'forex.terminology.margin',
  freeMargin: 'forex.terminology.freeMargin',
  equity: 'forex.terminology.equity',
  exposure: 'forex.terminology.exposure',
  swap: 'forex.terminology.swap',
  commission: 'forex.terminology.commission',
  stopLoss: 'forex.terminology.stopLoss',
  takeProfit: 'forex.terminology.takeProfit',
  position: 'forex.terminology.position',
  long: 'forex.terminology.long',
  short: 'forex.terminology.short',
  liquidation: 'forex.terminology.liquidation',
} as const;

export const CRYPTO_TERMINOLOGY = {
  spot: 'crypto.terminology.spot',
  orderBook: 'crypto.terminology.orderBook',
  marketOrder: 'crypto.terminology.marketOrder',
  limitOrder: 'crypto.terminology.limitOrder',
  deposit: 'crypto.terminology.deposit',
  withdrawal: 'crypto.terminology.withdrawal',
  p2p: 'crypto.terminology.p2p',
  escrow: 'crypto.terminology.escrow',
  networkFee: 'crypto.terminology.networkFee',
} as const;

export type ForexTerminologyKey = keyof typeof FOREX_TERMINOLOGY;
export type CryptoTerminologyKey = keyof typeof CRYPTO_TERMINOLOGY;
