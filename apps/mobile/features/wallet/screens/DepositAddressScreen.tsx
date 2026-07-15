import { useEffect, useMemo, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorBanner, ErrorState } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { ApiError } from '@core/api/errors/ApiError';
import { useAppStore } from '@core/state/appStore';
import {
  useDepositAddress,
  useKycStatus,
  useDepositTokens,
  useRecentDeposits,
  useTokenChains,
} from '../hooks/useBlockchainWallet';
import { AddressQRCard } from '../components/AddressQRCard';
import { DepositFlowHeader } from '../components/DepositFlowHeader';
import { DepositWarningsSection } from '../components/DepositWarningsSection';
import { DepositRecentPreview } from '../components/DepositRecentPreview';
import { isChainDepositEnabled } from '@core/domain/wallet/deposit';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositAddress'>;

export function DepositAddressScreen({ route, navigation }: Props) {
  const { symbol, chainId, chainName, chainType, confirmations } = route.params;

  useEffect(() => {
    if (!chainId) {
      navigation.replace('DepositNetwork', { symbol, name: symbol });
    }
  }, [chainId, symbol, navigation]);

  const isOnline = useAppStore((s) => s.isOnline);
  const q = useDepositAddress(chainId);
  const kycQ = useKycStatus();
  const tokensQ = useDepositTokens();
  const chainsQ = useTokenChains(symbol);
  const recentQ = useRecentDeposits(10, symbol);

  useEffect(() => {
    analytics.screen('S-512');
  }, []);

  const token = tokensQ.data?.find((t) => t.symbol === symbol);
  const chain = chainsQ.data?.find((c) => c.id === chainId);
  const depositEnabled = chain ? isChainDepositEnabled(chain) : true;

  const addressError = useMemo(() => {
    if (!q.isError) return null;
    const err = q.error;
    if (err instanceof ApiError) {
      if (err.code === 'KYC_REQUIRED') {
        return 'Complete identity verification (KYC) to view your deposit address.';
      }
      return err.message || 'Could not load deposit address.';
    }
    return 'Failed to load deposit address. Check KYC or try another network.';
  }, [q.isError, q.error]);

  const onRefresh = useCallback(() => {
    void q.refetch();
    void recentQ.refetch();
    void kycQ.refetch();
  }, [q, recentQ, kycQ]);

  if (!chainId) {
    return (
      <ScreenLayout testID="S-512">
        <SkeletonList rows={4} />
      </ScreenLayout>
    );
  }

  const loading = q.isLoading && !q.data;
  const refreshing = q.isFetching || recentQ.isFetching;

  return (
    <ScreenLayout testID="S-512">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DepositFlowHeader
          symbol={symbol}
          name={token?.name ?? symbol}
          network={chainName ?? chain?.name}
          depositEnabled={depositEnabled}
          step="Step 3 · Confirm deposit details"
        />

        {!isOnline ? (
          <ErrorBanner message="Offline — showing cached address if available" onRetry={onRefresh} />
        ) : null}

        {!kycQ.data?.verified && kycQ.data ? (
          <ErrorBanner message="KYC verification may be required before deposits are credited." />
        ) : null}

        {loading ? (
          <SkeletonList rows={6} />
        ) : addressError && !q.data ? (
          <ErrorState title="Address unavailable" message={addressError} onRetry={onRefresh} />
        ) : q.data ? (
          <>
            <AddressQRCard
              address={q.data.address}
              qrData={q.data.qrCodeData}
              memo={q.data.memo}
              notice={q.data.notice}
              chainName={chainName ?? q.data.chain.name}
              confirmations={confirmations ?? q.data.chain.confirmationsRequired}
              loading={q.isFetching}
              onRefresh={onRefresh}
            />

            <DepositWarningsSection
              symbol={symbol}
              chainName={chainName ?? q.data.chain.name}
              minDeposit={token?.min_deposit}
              confirmations={confirmations ?? q.data.chain.confirmationsRequired}
              chainType={chainType ?? q.data.chain.type}
            />

            <DepositRecentPreview
              items={recentQ.data ?? []}
              isLoading={recentQ.isLoading}
              error={recentQ.isError}
              onRetry={() => void recentQ.refetch()}
              onViewAll={() => navigation.navigate('DepositHistory')}
              onSelect={(txHash) => navigation.navigate('DepositDetail', { txHash })}
            />
          </>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
});
