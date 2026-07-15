import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { formatNetworkLabel } from '@core/domain/wallet/withdraw';
import type { WalletChain } from '@exchange/mobile-types';
import type { DepositToken } from '@exchange/mobile-types';

type Props = {
  chains: WalletChain[];
  token?: DepositToken;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function AssetNetworksSection({ chains, token, loading, error, onRetry }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>NETWORKS</Text>
      {token ? (
        <View style={[styles.tokenMeta, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
          {token.min_deposit ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
              Min deposit: {token.min_deposit} {token.symbol}
            </Text>
          ) : null}
          {token.min_withdrawal ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
              Min withdrawal: {token.min_withdrawal} {token.symbol}
            </Text>
          ) : null}
          {token.withdrawal_fee ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
              Withdrawal fee: {token.withdrawal_fee} {token.symbol}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState title="Networks unavailable" onRetry={onRetry} />
      ) : chains.length === 0 ? (
        <EmptyState title="No networks" message="Supported networks will appear when available." />
      ) : (
        chains.map((chain, idx) => {
          const inactive = chain.is_active === false;
          return (
            <View
              key={chain.id}
              style={[
                styles.row,
                idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
                  {formatNetworkLabel(chain.name, chain.confirmations_required)}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                  {chain.type?.toUpperCase() ?? '—'}
                </Text>
              </View>
              <View style={styles.badges}>
                <Badge
                  label={inactive ? 'Deposit off' : 'Deposit'}
                  ok={!inactive}
                  theme={theme.colors.tradeBuy}
                />
                <Badge
                  label={inactive ? 'Withdraw off' : 'Withdraw'}
                  ok={!inactive}
                  theme={theme.colors.statusInfo}
                />
              </View>
            </View>
          );
        })
      )}
    </ExchangeCard>
  );
}

function Badge({ label, ok, theme }: { label: string; ok: boolean; theme: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: ok ? `hsl(${theme} / 0.12)` : `hsl(220 13% 50% / 0.12)` }]}>
      <Text style={{ color: ok ? `hsl(${theme})` : `hsl(220 13% 55%)`, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  tokenMeta: { padding: 10, borderRadius: 8, gap: 4, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  badges: { gap: 4, alignItems: 'flex-end' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
