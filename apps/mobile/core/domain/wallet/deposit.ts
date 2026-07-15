import type { WalletChain } from '@exchange/mobile-types';

/** Coins that require memo/tag on deposit (website parity). */
export const MEMO_TAG_COINS = new Set(['XRP', 'XLM', 'ATOM', 'EOS', 'HBAR', 'STX', 'TON']);

export const POPULAR_DEPOSIT_COINS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'TRX'] as const;

const EXPLORER_BASE: Record<string, string> = {
  ETH: 'https://etherscan.io/tx/',
  BSC: 'https://bscscan.com/tx/',
  BNB: 'https://bscscan.com/tx/',
  MATIC: 'https://polygonscan.com/tx/',
  ARB: 'https://arbiscan.io/tx/',
  BASE: 'https://basescan.org/tx/',
  BTC: 'https://mempool.space/tx/',
  SOL: 'https://solscan.io/tx/',
  TRX: 'https://tronscan.org/#/transaction/',
};

export function needsMemoTag(symbol: string): boolean {
  return MEMO_TAG_COINS.has(symbol.toUpperCase());
}

export function estimateArrivalTime(confirmations?: number, chainType?: string): string {
  if (!confirmations || confirmations <= 0) return 'Varies by network';
  const t = (chainType ?? '').toLowerCase();
  const blockSec = t.includes('btc') ? 600 : t.includes('sol') ? 0.5 : 12;
  const minutes = Math.max(1, Math.ceil((confirmations * blockSec) / 60));
  return minutes === 1 ? '~1 min' : `~${minutes} min`;
}

export function buildDepositExplorerUrl(txHash: string, chainSymbol?: string, explorerBase?: string): string | null {
  if (!txHash) return null;
  if (explorerBase) {
    const base = explorerBase.replace(/\/+$/, '');
    return `${base}/${txHash}`;
  }
  const key = (chainSymbol ?? 'ETH').toUpperCase();
  const prefix = EXPLORER_BASE[key] ?? EXPLORER_BASE.ETH;
  return `${prefix}${txHash}`;
}

export function depositStatusLabel(status: string, confirmations?: number, required?: number): string {
  const s = status.toLowerCase();
  if ((s === 'pending' || s === 'confirming') && required) {
    return `${confirmations ?? 0}/${required} confirmations`;
  }
  return status;
}

export function isChainDepositEnabled(chain: WalletChain): boolean {
  return chain.is_active !== false;
}

export function pickRecommendedChain(chains: WalletChain[]): WalletChain | null {
  const active = chains.filter(isChainDepositEnabled);
  return active[0] ?? chains[0] ?? null;
}

export function truncateHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
