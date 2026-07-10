import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { getWalletRepository } from '@core/repositories/WalletRepository';
import { getConvertRepository } from '@core/repositories/ConvertRepository';
import { appEventBus } from '@core/events/appEventBus';
import { CACHE_TTL_MS } from '@core/offline/cacheTTL';
import type { TransferRequest, AccountType } from '@exchange/mobile-types';
import type { ConvertInstantRequest } from '@exchange/mobile-types';

export const PORTFOLIO_KEY = ['portfolio'] as const;
export const FUNDING_KEY = ['balances', 'funding'] as const;
export const TRADING_BAL_KEY = ['balances', 'trading'] as const;

export function usePortfolioSummary() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: () => getWalletRepository().getBalancesSummary(),
    staleTime: CACHE_TTL_MS.balances,
  });
  useEffect(() => {
    return appEventBus.on('balances:invalidate', () => {
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      void qc.invalidateQueries({ queryKey: FUNDING_KEY });
      void qc.invalidateQueries({ queryKey: TRADING_BAL_KEY });
    });
  }, [qc]);
  return q;
}

export function useFundingBalances() {
  return useQuery({
    queryKey: FUNDING_KEY,
    queryFn: () => getWalletRepository().getFundingBalances(),
    staleTime: CACHE_TTL_MS.balances,
  });
}

export function useTradingBalances() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: TRADING_BAL_KEY,
    queryFn: () => getWalletRepository().getSpotBalances(),
    staleTime: CACHE_TTL_MS.balances,
  });
  useEffect(() => {
    return appEventBus.on('balances:invalidate', () => {
      void qc.invalidateQueries({ queryKey: TRADING_BAL_KEY });
    });
  }, [qc]);
  return q;
}

export function usePortfolioHistory(period: '24h' | '7d' | '30d' | '90d' | '1y' = '7d') {
  return useQuery({
    queryKey: ['portfolioHistory', period],
    queryFn: () => getWalletRepository().getPortfolioHistory(period),
    staleTime: 60_000,
  });
}

export function usePnl(period = '7D') {
  return useQuery({
    queryKey: ['pnl', period],
    queryFn: () => getWalletRepository().getPnl({ period }),
    staleTime: 60_000,
  });
}

export function useTransferBalances(fromAccount: AccountType) {
  return useQuery({
    queryKey: ['transferBalances', fromAccount],
    queryFn: () => getWalletRepository().getTransferBalances(fromAccount),
    staleTime: 10_000,
  });
}

export function useExecuteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransferRequest) => getWalletRepository().executeTransfer(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      void qc.invalidateQueries({ queryKey: FUNDING_KEY });
      void qc.invalidateQueries({ queryKey: TRADING_BAL_KEY });
    },
  });
}

export function useTransferHistory() {
  return useInfiniteQuery({
    queryKey: ['transferHistory'],
    queryFn: ({ pageParam = 0 }) => getWalletRepository().getTransferHistory(20, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.items.length < 20 ? undefined : pages.length * 20),
  });
}

export function useLedger(params?: { asset?: string; type?: string }) {
  return useInfiniteQuery({
    queryKey: ['ledger', params?.asset, params?.type],
    queryFn: ({ pageParam = 1 }) =>
      getWalletRepository().getLedger({ page: pageParam, limit: 20, ...params }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

export function useFundHistory(kind?: string) {
  return useInfiniteQuery({
    queryKey: ['fundHistory', kind],
    queryFn: ({ pageParam = 1 }) =>
      getWalletRepository().getFundHistory({ page: pageParam, limit: 20, kind }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

export function useConvertCurrencies() {
  return useQuery({
    queryKey: ['convertCurrencies'],
    queryFn: () => getConvertRepository().getCurrencies(),
    staleTime: 300_000,
  });
}

export function useConvertQuote(from: string, to: string, amount: string, enabled: boolean) {
  return useQuery({
    queryKey: ['convertQuote', from, to, amount],
    queryFn: () => getConvertRepository().getQuote(from, to, amount),
    staleTime: 5_000,
    refetchInterval: enabled ? 10_000 : false,
    enabled: enabled && !!from && !!to && !!amount && from !== to,
  });
}

export function useExecuteConvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConvertInstantRequest) => getConvertRepository().executeInstant(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      void qc.invalidateQueries({ queryKey: FUNDING_KEY });
      void qc.invalidateQueries({ queryKey: TRADING_BAL_KEY });
    },
  });
}

export function useConvertHistory() {
  return useInfiniteQuery({
    queryKey: ['convertHistory'],
    queryFn: ({ pageParam = 1 }) => getConvertRepository().getHistory({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

export function useCoinInfo(symbol: string) {
  return useQuery({
    queryKey: ['coinInfo', symbol],
    queryFn: () => getWalletRepository().getCoinInfo(symbol),
    staleTime: 300_000,
    enabled: !!symbol,
  });
}
