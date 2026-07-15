import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import type {
  BalanceSummary,
  FundingBalances,
  SpotTradingBalances,
  SpotAccountBalance,
  TransferableToken,
  TransferRequest,
  TransferResult,
  TransferHistoryItem,
  PortfolioHistoryPoint,
  PnlSummary,
  LedgerEntry,
  FundHistoryItem,
  CoinInfo,
  AccountType,
  WalletChain,
  DepositToken,
  DepositAddress,
  DepositRecord,
  DepositDetail,
  WalletKycStatus,
  WithdrawalFeeInfo,
  WithdrawPreview,
  CreateWithdrawRequest,
  WithdrawalRecord,
} from '@exchange/mobile-types';
import { normalizeWalletTx } from '@core/domain/wallet/transactions';

type DepositsEnvelope = {
  success: boolean;
  data: DepositRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type WithdrawalsEnvelope = {
  success: boolean;
  data: WithdrawalRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type TransferHistoryEnvelope = {
  success: boolean;
  data: TransferHistoryItem[];
  total: number;
};

type LedgerEnvelope = {
  success: boolean;
  data: LedgerEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type FundHistoryEnvelope = {
  success: boolean;
  data: FundHistoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type TransactionsAllEnvelope = {
  success: boolean;
  data: Record<string, unknown>[];
  total: number;
};

export class WalletRepository extends BaseRepository {
  getBalancesSummary() {
    return this.http.request<BalanceSummary>('/wallet/balances/summary', { method: 'GET' });
  }

  getFundingBalances() {
    return this.http.request<FundingBalances>('/wallet/balances/funding', { method: 'GET' });
  }

  getSpotBalances() {
    return this.http.request<SpotTradingBalances>('/wallet/balances/trading', { method: 'GET' });
  }

  getSpotAccountBalances() {
    return this.http.request<SpotAccountBalance[]>('/wallet/balances/spot', { method: 'GET' });
  }

  getPortfolioHistory(period: '24h' | '7d' | '30d' | '90d' | '1y' = '7d') {
    return this.http.request<PortfolioHistoryPoint[]>(`/wallet/portfolio-history?period=${period}`, {
      method: 'GET',
    });
  }

  getPnl(params?: { period?: string; type?: string; symbol?: string }) {
    const q = new URLSearchParams();
    if (params?.period) q.set('period', params.period);
    if (params?.type) q.set('type', params.type);
    if (params?.symbol) q.set('symbol', params.symbol);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http.request<PnlSummary>(`/wallet/pnl${suffix}`, { method: 'GET' });
  }

  getTransferBalances(fromAccount: AccountType = 'funding') {
    return this.http.request<TransferableToken[]>(`/wallet/transfer/balances?from=${fromAccount}`, {
      method: 'GET',
    });
  }

  executeTransfer(body: TransferRequest) {
    return this.http.request<TransferResult>('/wallet/transfer', {
      method: 'POST',
      body,
      idempotent: true,
    });
  }

  getTransferHistory(limit = 20, offset = 0) {
    return this.http
      .request<TransferHistoryEnvelope>(
        `/wallet/transfer/history?limit=${limit}&offset=${offset}`,
        { method: 'GET', retainEnvelope: true },
      )
      .then((r) => ({ items: r.data, total: r.total }));
  }

  getLedger(params?: { page?: number; limit?: number; asset?: string; type?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.asset) q.set('asset', params.asset);
    if (params?.type) q.set('type', params.type);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<LedgerEnvelope>(`/wallet/ledger${suffix}`, { method: 'GET', retainEnvelope: true })
      .then((r) => ({ items: r.data, pagination: r.pagination }));
  }

  syncDeposits() {
    return this.http.request<{ message?: string }>('/wallet/deposits/sync', {
      method: 'POST',
      body: {},
    });
  }

  getTransactionsAll(params?: { limit?: number; offset?: number; coin?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.coin) q.set('coin', params.coin);
    if (params?.status) q.set('status', params.status);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<TransactionsAllEnvelope>(`/wallet/transactions/all${suffix}`, {
        method: 'GET',
        retainEnvelope: true,
      })
      .then((r) => ({
        items: (r.data ?? []).map((row) => normalizeWalletTx(row)),
        total: r.total ?? 0,
      }));
  }

  getFundHistory(params?: { page?: number; limit?: number; kind?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.kind) q.set('kind', params.kind);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<FundHistoryEnvelope>(`/wallet/fund-history${suffix}`, { method: 'GET', retainEnvelope: true })
      .then((r) => ({ items: r.data, pagination: r.pagination }));
  }

  getCoinInfo(symbol: string) {
    return this.http.request<CoinInfo>(`/wallet/coin-info/${encodeURIComponent(symbol)}`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getDepositTokens() {
    return this.http.request<DepositToken[]>('/wallet/deposit/tokens', { method: 'GET' });
  }

  getTokenChains(symbol: string) {
    return this.http.request<WalletChain[]>(`/wallet/tokens/${encodeURIComponent(symbol)}/chains`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getDepositAddress(chainId: string) {
    return this.http.request<DepositAddress>(`/wallet/deposit-address/${encodeURIComponent(chainId)}`, {
      method: 'GET',
    });
  }

  getDeposits(params?: { page?: number; limit?: number; status?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<DepositsEnvelope>(`/wallet/deposits${suffix}`, { method: 'GET', retainEnvelope: true })
      .then((r) => ({ items: r.data, pagination: r.pagination }));
  }

  getDepositDetail(txHash: string) {
    return this.http.request<DepositDetail>(`/wallet/deposit/${encodeURIComponent(txHash)}`, {
      method: 'GET',
    });
  }

  getKycStatus() {
    return this.http.request<WalletKycStatus>('/wallet/kyc-status', { method: 'GET' });
  }

  getWithdrawalFee(symbol: string, chainId: string) {
    return this.http.request<WithdrawalFeeInfo>(
      `/wallet/withdrawal-fee/${encodeURIComponent(symbol)}/${encodeURIComponent(chainId)}`,
      { method: 'GET' },
    );
  }

  getWithdrawPreview(params: { symbol: string; chainId: string; amount: string }) {
    const q = new URLSearchParams({
      symbol: params.symbol,
      chainId: params.chainId,
      amount: params.amount,
      type: 'onchain',
    });
    return this.http.request<WithdrawPreview>(`/wallet/withdraw/preview?${q}`, { method: 'GET' });
  }

  getWithdrawals(params?: { page?: number; limit?: number; status?: string; coin?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.coin) q.set('coin', params.coin);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<WithdrawalsEnvelope>(`/wallet/withdrawals${suffix}`, { method: 'GET', retainEnvelope: true })
      .then((r) => ({ items: r.data, pagination: r.pagination }));
  }

  createWithdrawal(body: CreateWithdrawRequest) {
    return this.http.request<WithdrawalRecord>('/wallet/withdrawals', {
      method: 'POST',
      body: { ...body, type: 'onchain' },
      idempotent: true,
    });
  }

  sendWithdrawalEmailOtp(withdrawalId: string) {
    return this.http.request<{ message: string; maskedEmail?: string }>(
      `/wallet/withdrawals/${withdrawalId}/send-email-otp`,
      { method: 'POST', body: {} },
    );
  }

  verifyWithdrawalEmailOtp(withdrawalId: string, otp: string) {
    return this.http.request<{ message: string }>(
      `/wallet/withdrawals/${withdrawalId}/verify-email-otp`,
      { method: 'POST', body: { otp } },
    );
  }

  cancelWithdrawal(withdrawalId: string) {
    return this.http.request<{ message: string }>(
      `/wallet/withdrawals/${withdrawalId}/cancel`,
      { method: 'POST', body: {} },
    );
  }
}

let walletRepository: WalletRepository | null = null;

export function getWalletRepository(): WalletRepository {
  if (!walletRepository) {
    walletRepository = new WalletRepository(getHttpClient());
  }
  return walletRepository;
}
