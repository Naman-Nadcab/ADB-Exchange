import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { getWalletRepository } from '@core/repositories/WalletRepository';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { appEventBus } from '@core/events/appEventBus';
import { useEffect } from 'react';
import type {
  CreateWithdrawRequest,
  WithdrawalAddressInput,
  AssetBalance,
  DepositToken,
  WalletChain,
  DepositAddress,
  DepositRecord,
  DepositDetail,
  WalletKycStatus,
  WithdrawalFeeInfo,
  WithdrawPreview,
  WithdrawalRecord,
  FundingBalances,
  WithdrawalAddress,
} from '@exchange/mobile-types';
import { FUNDING_KEY, PORTFOLIO_KEY } from './useWallet';

type DepositPage = { items: DepositRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
type WithdrawalPage = { items: WithdrawalRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

export function useDepositTokens() {
  return useQuery<DepositToken[]>({
    queryKey: ['depositTokens'],
    queryFn: () => getWalletRepository().getDepositTokens(),
    staleTime: 300_000,
  });
}

export function useTokenChains(symbol: string) {
  return useQuery<WalletChain[]>({
    queryKey: ['tokenChains', symbol],
    queryFn: () => getWalletRepository().getTokenChains(symbol),
    staleTime: 300_000,
    enabled: !!symbol,
  });
}

export function useDepositAddress(chainId: string) {
  return useQuery<DepositAddress>({
    queryKey: ['depositAddress', chainId],
    queryFn: () => getWalletRepository().getDepositAddress(chainId),
    staleTime: 60_000,
    enabled: !!chainId,
  });
}

export function useDeposits(status?: string) {
  return useInfiniteQuery<DepositPage, Error, InfiniteData<DepositPage>, readonly unknown[], number>({
    queryKey: ['deposits', status],
    queryFn: ({ pageParam }) =>
      getWalletRepository().getDeposits({ page: pageParam, limit: 20, status }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

export function useDepositDetail(txHash: string) {
  return useQuery<DepositDetail>({
    queryKey: ['depositDetail', txHash],
    queryFn: () => getWalletRepository().getDepositDetail(txHash),
    enabled: !!txHash,
  });
}

export function useKycStatus() {
  return useQuery<WalletKycStatus>({
    queryKey: ['kycStatus'],
    queryFn: () => getWalletRepository().getKycStatus(),
    staleTime: 120_000,
  });
}

export function useWithdrawPreview(
  symbol: string,
  chainId: string,
  amount: string,
  enabled: boolean,
) {
  return useQuery<WithdrawPreview>({
    queryKey: ['withdrawPreview', symbol, chainId, amount],
    queryFn: () => getWalletRepository().getWithdrawPreview({ symbol, chainId, amount }),
    staleTime: 5_000,
    enabled: enabled && !!symbol && !!chainId && !!amount,
  });
}

export function useWithdrawalFee(symbol: string, chainId: string) {
  return useQuery<WithdrawalFeeInfo>({
    queryKey: ['withdrawalFee', symbol, chainId],
    queryFn: () => getWalletRepository().getWithdrawalFee(symbol, chainId),
    staleTime: 60_000,
    enabled: !!symbol && !!chainId,
  });
}

export function useWithdrawals(coin?: string, status?: string) {
  return useInfiniteQuery<WithdrawalPage, Error, InfiniteData<WithdrawalPage>, readonly unknown[], number>({
    queryKey: ['withdrawals', coin, status],
    queryFn: ({ pageParam }) =>
      getWalletRepository().getWithdrawals({ page: pageParam, limit: 20, coin, status }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

export function useCreateWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWithdrawRequest) => getWalletRepository().createWithdrawal(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FUNDING_KEY });
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      appEventBus.emit('balances:invalidate');
    },
  });
}

export function useWithdrawalEmailOtp() {
  return useMutation({
    mutationFn: (withdrawalId: string) => getWalletRepository().sendWithdrawalEmailOtp(withdrawalId),
  });
}

export function useVerifyWithdrawalEmailOtp() {
  return useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) =>
      getWalletRepository().verifyWithdrawalEmailOtp(id, otp),
  });
}

export function useCancelWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getWalletRepository().cancelWithdrawal(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['withdrawals'] }),
  });
}

export function useWithdrawalAddresses() {
  return useQuery<WithdrawalAddress[]>({
    queryKey: ['withdrawalAddresses'],
    queryFn: () => getAuthRepository().getWithdrawalAddresses(),
    staleTime: 30_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WithdrawalAddressInput) => getAuthRepository().createWithdrawalAddress(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['withdrawalAddresses'] }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; note?: string; memo?: string }) =>
      getAuthRepository().updateWithdrawalAddress(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['withdrawalAddresses'] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getAuthRepository().deleteWithdrawalAddress(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['withdrawalAddresses'] }),
  });
}

export function useWithdrawSecurityStatus() {
  const twoFa = useQuery({ queryKey: ['2faStatus'], queryFn: () => getAuthRepository().get2FAStatus() });
  const fundPw = useQuery({
    queryKey: ['fundPasswordStatus'],
    queryFn: () => getAuthRepository().getFundPasswordStatus(),
  });
  const whitelist = useQuery({
    queryKey: ['whitelistStatus'],
    queryFn: () => getAuthRepository().getWhitelistStatus(),
  });
  const addressLock = useQuery({
    queryKey: ['newAddressLockStatus'],
    queryFn: () => getAuthRepository().getNewAddressLockStatus(),
  });
  return { twoFa, fundPw, whitelist, addressLock };
}

export function useVerify2FA() {
  return useMutation({ mutationFn: (code: string) => getAuthRepository().verify2FA(code) });
}

export function useFundingBalanceForSymbol(symbol: string) {
  const q = useQuery<FundingBalances>({
    queryKey: FUNDING_KEY,
    queryFn: () => getWalletRepository().getFundingBalances(),
    staleTime: 30_000,
  });
  useEffect(() => {
    return appEventBus.on('balances:invalidate', () => void q.refetch());
  }, [q]);
  const balance = q.data?.balances.find((b: AssetBalance) => b.symbol === symbol);
  return { ...q, available: balance?.available_balance ?? '0', total: balance?.total_balance ?? '0' };
}
