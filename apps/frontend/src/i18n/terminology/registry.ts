/**
 * Central terminology keys for future professional translation.
 * Keys are stable identifiers — not user-facing copy.
 * Use contextual keys when semantics differ (e.g. close modal vs close position).
 */

export const COMMON_UI_TERMINOLOGY = {
  actions: {
    save: 'common.actions.save',
    cancel: 'common.actions.cancel',
    confirm: 'common.actions.confirm',
    retry: 'common.actions.retry',
  },
  closeModal: 'common.close.modal',
  closePanel: 'common.close.panel',
} as const;

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
  closePosition: 'forex.actions.closePosition',
  closeOrder: 'forex.actions.closeOrder',
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
  cancelOrder: 'crypto.actions.cancelOrder',
} as const;

export const P2P_TERMINOLOGY = {
  escrow: 'p2p.terminology.escrow',
  dispute: 'p2p.terminology.dispute',
  release: 'p2p.actions.release',
  confirmPayment: 'p2p.actions.confirmPayment',
} as const;

export type ForexTerminologyKey = keyof typeof FOREX_TERMINOLOGY;
export type CryptoTerminologyKey = keyof typeof CRYPTO_TERMINOLOGY;
