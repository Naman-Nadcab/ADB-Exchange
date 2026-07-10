import { useEffect, useMemo } from 'react';
import { ScrollView, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useDepositAddress, useKycStatus, useDepositTokens, useDeposits } from '../hooks/useBlockchainWallet';
import { AddressQRCard } from '../components/AddressQRCard';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositAddress'>;

export function DepositAddressScreen({ route, navigation }: Props) {
  const { symbol, chainId, chainName } = route.params;
  const { theme } = useTheme();
  const q = useDepositAddress(chainId);
  const kycQ = useKycStatus();
  const tokensQ = useDepositTokens();
  const depositsQ = useDeposits();

  useEffect(() => {
    analytics.screen('S-512');
  }, []);

  const token = tokensQ.data?.find((t) => t.symbol === symbol);
  const recentDeposits = useMemo(() => {
    const seen = new Set<string>();
    const items = [];
    for (const d of depositsQ.data?.pages.flatMap((p) => p.items) ?? []) {
      if (d.symbol !== symbol) continue;
      const key = `${d.symbol}-${d.chain_name ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(d);
      if (items.length >= 3) break;
    }
    return items;
  }, [depositsQ.data, symbol]);

  if (q.isLoading) {
    return (
      <ScreenLayout testID="S-512">
        <SkeletonList rows={5} />
      </ScreenLayout>
    );
  }

  if (q.isError || !q.data) {
    return (
      <ScreenLayout testID="S-512">
        <ErrorBanner message="Failed to load deposit address. Check KYC or try another network." />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-512">
      <ScrollView>
        <Text style={styles.title}>Deposit {symbol}</Text>
        {token?.min_deposit ? (
          <Text style={styles.warn}>Minimum deposit: {token.min_deposit} {symbol}</Text>
        ) : null}
        {!kycQ.data?.verified ? (
          <Text style={styles.warn}>KYC may be required before deposits are credited.</Text>
        ) : null}
        {recentDeposits.length ? (
          <>
            <Text style={[styles.section, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Recent deposits
            </Text>
            {recentDeposits.map((d) => (
              <Pressable
                key={d.id}
                onPress={() =>
                  d.tx_hash ? navigation.navigate('DepositDetail', { txHash: d.tx_hash }) : undefined
                }
              >
                <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, marginBottom: 4 }}>
                  {d.symbol} · {d.chain_name ?? 'Network'} · {d.status}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        <AddressQRCard
          address={q.data.address}
          qrData={q.data.qrCodeData}
          memo={q.data.memo}
          notice={q.data.notice}
          chainName={chainName ?? q.data.chain.name}
          confirmations={q.data.chain.confirmationsRequired}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  warn: { color: '#F59E0B', fontSize: 12, marginBottom: 8 },
});
