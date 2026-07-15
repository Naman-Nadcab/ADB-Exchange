import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getWalletRepository } from '@core/repositories/WalletRepository';
import { getConvertRepository } from '@core/repositories/ConvertRepository';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import {
  applyWalletHistoryFilters,
  DEFAULT_WALLET_HISTORY_FILTERS,
  mapFromConvertHistoryItem,
  mapFromDepositHistoryRecord,
  mapFromLedgerEntry,
  mapFromTransferHistoryItem,
  mapFromWalletRecentTransaction,
  mapFromWithdrawalRecord,
  type WalletHistoryFilters,
  type WalletHistoryRow,
  type WalletHistoryTab,
} from '@core/domain/wallet/walletHistory';

const PAGE_SIZE = 20;

export function useWalletHistoryFilters(initial?: Partial<WalletHistoryFilters>) {
  const [filters, setFilters] = useState<WalletHistoryFilters>(() => ({
    ...DEFAULT_WALLET_HISTORY_FILTERS,
    ...initial,
  }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = mmkvStorage.getString(CACHE_KEYS.walletHistoryFilters);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<WalletHistoryFilters>;
        setFilters((prev) => ({ ...prev, ...saved, ...initial }));
      } catch {
        // ignore corrupt cache
      }
    }
    setHydrated(true);
  }, [initial]);

  useEffect(() => {
    if (!hydrated) return;
    mmkvStorage.set(CACHE_KEYS.walletHistoryFilters, JSON.stringify(filters));
  }, [filters, hydrated]);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_WALLET_HISTORY_FILTERS, asset: initial?.asset ?? '' });
  }, [initial?.asset]);

  const patchFilters = useCallback((patch: Partial<WalletHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return { filters, setFilters, patchFilters, resetFilters, hydrated };
}

export function useTransactionsAllInfinite(
  params?: { coin?: string; status?: string },
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ['transactionsAll', params?.coin, params?.status],
    queryFn: async ({ pageParam = 0 }) => {
      if (pageParam === 0) {
        try {
          await getWalletRepository().syncDeposits();
        } catch {
          // non-blocking
        }
      }
      return getWalletRepository().getTransactionsAll({
        ...params,
        limit: 50,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.items.length, 0);
      if (last.items.length < 50 || loaded >= last.total) return undefined;
      return loaded;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const items = query.state.data?.pages.flatMap((p) => p.items) ?? [];
      const hasPending = items.some((tx) =>
        ['pending', 'confirming', 'processing'].includes(tx.status.toLowerCase()),
      );
      return hasPending ? 3000 : 5000;
    },
  });
}

function useDepositHistoryInfinite(status?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['depositHistory', status, 'walletHistory'],
    queryFn: ({ pageParam = 1 }) =>
      getWalletRepository().getDepositHistory({ page: pageParam, limit: PAGE_SIZE, status }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled,
    staleTime: 30_000,
    refetchInterval: 5000,
  });
}

function useWithdrawalsInfinite(coin?: string, status?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['withdrawals', coin, status, 'walletHistory'],
    queryFn: ({ pageParam = 1 }) =>
      getWalletRepository().getWithdrawals({ page: pageParam, limit: PAGE_SIZE, coin, status }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled,
    staleTime: 30_000,
  });
}

function useTransferHistoryInfinite(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['transferHistory', 'walletHistory'],
    queryFn: ({ pageParam = 0 }) => getWalletRepository().getTransferHistory(PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.items.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
    enabled,
    staleTime: 30_000,
  });
}

function useConvertHistoryInfinite(status?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['convertHistory', status, 'walletHistory'],
    queryFn: ({ pageParam = 1 }) =>
      getConvertRepository().getHistory({ page: pageParam, limit: PAGE_SIZE, status }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled,
    staleTime: 30_000,
  });
}

function useLedgerFeesInfinite(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['ledger', 'fees', 'walletHistory'],
    queryFn: ({ pageParam = 1 }) =>
      getWalletRepository().getLedger({ page: pageParam, limit: PAGE_SIZE, type: 'spot_trade' }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled,
    staleTime: 60_000,
  });
}

export function useWalletHistoryTab(
  tab: WalletHistoryTab,
  serverFilters: { coin?: string; status?: string },
) {
  const allQ = useTransactionsAllInfinite(serverFilters, tab === 'all');
  const depositQ = useDepositHistoryInfinite(serverFilters.status, tab === 'deposit');
  const withdrawQ = useWithdrawalsInfinite(serverFilters.coin, serverFilters.status, tab === 'withdraw');
  const transferQ = useTransferHistoryInfinite(tab === 'transfer');
  const convertQ = useConvertHistoryInfinite(serverFilters.status, tab === 'convert');
  const feesQ = useLedgerFeesInfinite(tab === 'fees');

  const active =
    tab === 'all'
      ? allQ
      : tab === 'deposit'
        ? depositQ
        : tab === 'withdraw'
          ? withdrawQ
          : tab === 'transfer'
            ? transferQ
            : tab === 'convert'
              ? convertQ
              : feesQ;

  const rawRows = useMemo((): WalletHistoryRow[] => {
    if (tab === 'all') {
      return allQ.data?.pages.flatMap((p) => p.items.map(mapFromWalletRecentTransaction)) ?? [];
    }
    if (tab === 'deposit') {
      return depositQ.data?.pages.flatMap((p) => p.items.map(mapFromDepositHistoryRecord)) ?? [];
    }
    if (tab === 'withdraw') {
      return withdrawQ.data?.pages.flatMap((p) => p.items.map(mapFromWithdrawalRecord)) ?? [];
    }
    if (tab === 'transfer') {
      return transferQ.data?.pages.flatMap((p) => p.items.map(mapFromTransferHistoryItem)) ?? [];
    }
    if (tab === 'convert') {
      return convertQ.data?.pages.flatMap((p) => p.items.map(mapFromConvertHistoryItem)) ?? [];
    }
    return (
      feesQ.data?.pages.flatMap((p) =>
        p.items.filter((e) => parseFloat(e.fee) > 0 || e.type === 'spot_trade').map(mapFromLedgerEntry),
      ) ?? []
    );
  }, [tab, allQ.data, depositQ.data, withdrawQ.data, transferQ.data, convertQ.data, feesQ.data]);

  return {
    ...active,
    rawRows,
  };
}

export function useFilteredWalletHistory(
  tab: WalletHistoryTab,
  filters: WalletHistoryFilters,
  serverFilters: { coin?: string; status?: string },
) {
  const q = useWalletHistoryTab(tab, serverFilters);
  const rows = useMemo(
    () => applyWalletHistoryFilters(q.rawRows, filters),
    [q.rawRows, filters],
  );
  return { ...q, rows };
}
