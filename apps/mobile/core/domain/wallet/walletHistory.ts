import type {
  ConvertHistoryItem,
  DepositHistoryRecord,
  LedgerEntry,
  TransferHistoryItem,
  WalletRecentTransaction,
  WithdrawalRecord,
} from '@exchange/mobile-types';
import { convertStatusLabel } from './convert';
import { depositStatusLabel } from './deposit';
import { transferAccountLabel, transferStatusLabel } from './transfer';
import { withdrawalStatusLabel } from './withdraw';

export type WalletHistoryTab = 'all' | 'deposit' | 'withdraw' | 'transfer' | 'convert' | 'fees';

export const WALLET_HISTORY_TABS: { id: WalletHistoryTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'convert', label: 'Convert' },
  { id: 'fees', label: 'Fees' },
];

export type WalletHistoryMethodFilter = 'all' | 'on-chain' | 'internal';

export type WalletHistoryFilters = {
  asset: string;
  status: string;
  method: WalletHistoryMethodFilter;
  startDate: string;
  endDate: string;
  search: string;
};

export const DEFAULT_WALLET_HISTORY_FILTERS: WalletHistoryFilters = {
  asset: '',
  status: '',
  method: 'all',
  startDate: '',
  endDate: '',
  search: '',
};

export type WalletHistoryDetailTarget =
  | { screen: 'DepositDetail'; params: { txHash: string } }
  | { screen: 'WithdrawalDetail'; params: { withdrawalId: string; snapshot?: WithdrawalRecord } }
  | { screen: 'TransferDetail'; params: { transferId: string } }
  | { screen: 'ConvertDetail'; params: { conversionId: string } };

export type WalletHistoryRow = {
  id: string;
  kind: WalletHistoryTab | 'withdrawal';
  symbol: string;
  amount: string;
  direction: 'in' | 'out' | 'neutral';
  status: string;
  statusLabel: string;
  createdAt: string;
  network?: string;
  account?: string;
  fee?: string;
  address?: string;
  txid?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  explorerUrl?: string | null;
  method?: 'on-chain' | 'internal';
  typeLabel: string;
  detail?: WalletHistoryDetailTarget;
};

export type WalletHistoryTimelineStep = {
  id: string;
  label: string;
  state: 'done' | 'active' | 'pending' | 'failed';
  timestamp?: string;
};

export function walletHistoryStatusTone(status: string): 'live' | 'sync' | 'warn' | 'off' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'confirmed') return 'live';
  if (s === 'pending' || s === 'processing' || s === 'confirming') return 'warn';
  if (s === 'failed' || s === 'rejected' || s === 'cancelled') return 'off';
  return 'neutral';
}

export function inferOnChainMethod(input: {
  kind: string;
  chainType?: string;
  address?: string;
  txid?: string;
  withdrawalType?: string;
}): 'on-chain' | 'internal' | undefined {
  if (input.kind === 'transfer' || input.kind === 'convert' || input.kind === 'fees') return 'internal';
  if (input.withdrawalType === 'internal') return 'internal';
  if (input.chainType?.toLowerCase().includes('sent to')) return 'internal';
  if (input.address?.includes('@')) return 'internal';
  if (input.txid || input.address) return 'on-chain';
  return undefined;
}

export function mapFromWalletRecentTransaction(tx: WalletRecentTransaction): WalletHistoryRow {
  const direction = tx.type === 'deposit' ? 'in' : tx.type === 'withdrawal' ? 'out' : 'neutral';
  const method =
    tx.method ??
    inferOnChainMethod({
      kind: tx.type,
      chainType: tx.chain_type,
      address: tx.address,
      txid: tx.txid,
    });
  let detail: WalletHistoryDetailTarget | undefined;
  if (tx.type === 'deposit' && tx.txid) {
    detail = { screen: 'DepositDetail', params: { txHash: tx.txid } };
  } else if (tx.type === 'withdrawal') {
    detail = {
      screen: 'WithdrawalDetail',
      params: {
        withdrawalId: tx.id,
        snapshot: {
          id: tx.id,
          symbol: tx.symbol,
          asset: tx.symbol,
          amount: tx.amount,
          quantity: tx.amount,
          fee: tx.fee,
          address: tx.address,
          chain_name: tx.chain_type,
          status: tx.status,
          txid: tx.txid,
        },
      },
    };
  } else if (tx.type === 'transfer') {
    detail = { screen: 'TransferDetail', params: { transferId: tx.id } };
  }

  const statusLabel =
    tx.type === 'deposit'
      ? depositStatusLabel(tx.status, tx.confirmations ?? 0, tx.requiredConfirmations ?? 25)
      : tx.type === 'withdrawal'
        ? withdrawalStatusLabel(tx.status)
        : transferStatusLabel(tx.status);

  return {
    id: tx.id,
    kind: tx.type === 'withdrawal' ? 'withdraw' : tx.type === 'deposit' ? 'deposit' : tx.type,
    symbol: tx.symbol,
    amount: tx.amount,
    direction,
    status: tx.status,
    statusLabel,
    createdAt: tx.created_at,
    network: tx.chain_type,
    fee: tx.fee,
    address: tx.address,
    txid: tx.txid,
    confirmations: tx.confirmations,
    requiredConfirmations: tx.requiredConfirmations,
    explorerUrl: tx.explorerUrl,
    method,
    typeLabel: tx.type,
    detail,
  };
}

export function mapFromDepositHistoryRecord(d: DepositHistoryRecord): WalletHistoryRow {
  return {
    id: d.id,
    kind: 'deposit',
    symbol: d.symbol,
    amount: d.amount,
    direction: 'in',
    status: d.status,
    statusLabel: depositStatusLabel(d.status, d.confirmations, d.requiredConfirmations),
    createdAt: d.createdAt,
    network: d.chainName ?? undefined,
    address: d.fromAddress ?? undefined,
    txid: d.txHash ?? undefined,
    confirmations: d.confirmations,
    requiredConfirmations: d.requiredConfirmations,
    explorerUrl: d.explorerUrl,
    method: 'on-chain',
    typeLabel: 'deposit',
    detail: d.txHash ? { screen: 'DepositDetail', params: { txHash: d.txHash } } : undefined,
  };
}

export function mapFromWithdrawalRecord(w: WithdrawalRecord): WalletHistoryRow {
  const symbol = w.asset ?? w.symbol ?? '';
  const amount = w.quantity ?? w.amount ?? '0';
  const method = inferOnChainMethod({
    kind: 'withdraw',
    chainType: w.chain_name ?? w.chain,
    address: w.address ?? w.toAddress,
    txid: w.txid ?? w.tx_hash,
    withdrawalType: w.type,
  });
  return {
    id: w.id,
    kind: 'withdraw',
    symbol,
    amount,
    direction: 'out',
    status: w.status,
    statusLabel: withdrawalStatusLabel(w.displayStatus ?? w.status),
    createdAt: w.date_time ?? w.createdAt ?? '',
    network: w.chain_name ?? w.chain,
    account: method === 'internal' ? w.address ?? w.toAddress : undefined,
    fee: w.fee,
    address: w.address ?? w.toAddress,
    txid: w.txid ?? w.tx_hash,
    method,
    typeLabel: 'withdrawal',
    detail: { screen: 'WithdrawalDetail', params: { withdrawalId: w.id, snapshot: w } },
  };
}

export function mapFromTransferHistoryItem(t: TransferHistoryItem): WalletHistoryRow {
  return {
    id: t.id,
    kind: 'transfer',
    symbol: t.symbol,
    amount: t.amount,
    direction: t.direction === 'received' ? 'in' : 'out',
    status: t.status,
    statusLabel: transferStatusLabel(t.status),
    createdAt: t.createdAt,
    network: t.description,
    account: `${transferAccountLabel(t.fromAccount)} → ${transferAccountLabel(t.toAccount)}`,
    method: 'internal',
    typeLabel: 'transfer',
    detail: { screen: 'TransferDetail', params: { transferId: t.id } },
  };
}

export function mapFromConvertHistoryItem(c: ConvertHistoryItem): WalletHistoryRow {
  return {
    id: c.id,
    kind: 'convert',
    symbol: `${c.from_symbol}→${c.to_symbol}`,
    amount: `${c.from_amount} → ${c.to_amount}`,
    direction: 'neutral',
    status: c.status,
    statusLabel: convertStatusLabel(c.status),
    createdAt: c.created_at,
    network: c.conversion_type,
    account: transferAccountLabel(c.account_type),
    fee: c.fee_amount,
    method: 'internal',
    typeLabel: 'convert',
    detail: { screen: 'ConvertDetail', params: { conversionId: c.id } },
  };
}

export function mapFromLedgerEntry(entry: LedgerEntry): WalletHistoryRow {
  return {
    id: entry.id,
    kind: 'fees',
    symbol: entry.asset,
    amount: entry.amount,
    direction: entry.direction,
    status: entry.status,
    statusLabel: entry.displayStatus || entry.status,
    createdAt: entry.created_at,
    fee: entry.fee,
    method: 'internal',
    typeLabel: entry.type.replace(/_/g, ' '),
  };
}

export function matchesWalletHistorySearch(row: WalletHistoryRow, query: string): boolean {
  if (!query.trim()) return true;
  const s = query.trim().toLowerCase();
  return (
    row.symbol.toLowerCase().includes(s) ||
    row.network?.toLowerCase().includes(s) ||
    row.address?.toLowerCase().includes(s) ||
    row.txid?.toLowerCase().includes(s) ||
    row.account?.toLowerCase().includes(s) ||
    row.typeLabel.toLowerCase().includes(s) ||
    row.statusLabel.toLowerCase().includes(s)
  );
}

export function applyWalletHistoryFilters(rows: WalletHistoryRow[], filters: WalletHistoryFilters): WalletHistoryRow[] {
  let list = [...rows];
  if (filters.asset) {
    const asset = filters.asset.toUpperCase();
    list = list.filter((r) => r.symbol.toUpperCase().includes(asset) || r.symbol.toUpperCase().split('→').some((p) => p.includes(asset)));
  }
  if (filters.status) {
    const status = filters.status.toLowerCase();
    list = list.filter((r) => r.status.toLowerCase() === status);
  }
  if (filters.method !== 'all') {
    list = list.filter((r) => {
      if (filters.method === 'internal') return r.method === 'internal';
      return r.method === 'on-chain';
    });
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    list = list.filter((r) => new Date(r.createdAt).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(`${filters.endDate}T23:59:59`).getTime();
    list = list.filter((r) => new Date(r.createdAt).getTime() <= end);
  }
  if (filters.search.trim()) {
    list = list.filter((r) => matchesWalletHistorySearch(r, filters.search));
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function buildWalletHistoryTimeline(status: string, kind: string): WalletHistoryTimelineStep[] {
  const s = status.toLowerCase();
  const failed = s === 'failed' || s === 'rejected' || s === 'cancelled';
  const completed = s === 'completed' || s === 'confirmed';
  const active = !failed && !completed;

  const submitted = { id: 'submitted', label: 'Submitted', state: 'done' as const };
  const processing = {
    id: 'processing',
    label: kind === 'deposit' ? 'Confirming' : 'Processing',
    state: failed ? ('failed' as const) : completed ? ('done' as const) : active ? ('active' as const) : ('pending' as const),
  };
  const done = {
    id: 'completed',
    label: failed ? 'Failed' : 'Completed',
    state: failed ? ('failed' as const) : completed ? ('done' as const) : ('pending' as const),
  };
  return [submitted, processing, done];
}

export function truncateWalletHistoryValue(value: string, max = 16): string {
  if (!value) return '—';
  if (value.length <= max) return value;
  const half = Math.floor((max - 3) / 2);
  return `${value.slice(0, half)}...${value.slice(-half)}`;
}

export function formatWalletHistoryAmount(row: WalletHistoryRow): string {
  if (row.kind === 'convert') return row.amount;
  const prefix = row.direction === 'in' ? '+' : row.direction === 'out' ? '-' : '';
  return `${prefix}${row.amount}`;
}
