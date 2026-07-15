import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard, SearchBar, Avatar, SkeletonList, ErrorState } from '@shared/ui';
import type { TransferableToken } from '@exchange/mobile-types';
import { POPULAR_DEPOSIT_COINS } from '@core/domain/wallet/deposit';
import { filterTransferTokens } from '@core/domain/wallet/transfer';

type Props = {
  tokens: TransferableToken[];
  selectedId: string;
  onSelect: (token: TransferableToken) => void;
  search: string;
  onSearchChange: (v: string) => void;
  hideZero: boolean;
  onHideZeroChange: (v: boolean) => void;
  favorites: Set<string>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

export function TransferCoinPicker({
  tokens,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  hideZero,
  onHideZeroChange,
  favorites,
  isLoading,
  isError,
  onRetry,
}: Props) {
  const { theme } = useTheme();
  const filtered = filterTransferTokens(tokens, { search, hideZero, favorites });
  const popular = POPULAR_DEPOSIT_COINS.map((sym) => tokens.find((t) => t.symbol.toUpperCase() === sym)).filter(Boolean);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>COIN</Text>
      <SearchBar value={search} onChangeText={onSearchChange} placeholder="Search coins..." />
      <View style={styles.toggleRow}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Hide zero balances</Text>
        <Switch value={hideZero} onValueChange={onHideZeroChange} />
      </View>

      {popular.length ? (
        <View style={styles.chips}>
          {popular.map((t) =>
            t ? (
              <Pressable
                key={t.tokenId}
                onPress={() => onSelect(t)}
                style={[
                  styles.chip,
                  {
                    borderColor: `hsl(${theme.colors.borderDefault})`,
                    backgroundColor:
                      selectedId === t.tokenId ? `hsl(${theme.colors.brandPrimary} / 0.12)` : `hsl(${theme.colors.surfaceMuted} / 0.4)`,
                  },
                ]}
              >
                <Avatar name={t.symbol} size="sm" />
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 11 }}>
                  {t.symbol}
                  {favorites.has(t.symbol) ? ' ★' : ''}
                </Text>
              </Pressable>
            ) : null,
          )}
        </View>
      ) : null}

      {isLoading && !tokens.length ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState title="Could not load balances" onRetry={onRetry} />
      ) : (
        <ExchangeCard variant="terminal" style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={{ padding: 16, color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>
              No coins found
            </Text>
          ) : (
            filtered.slice(0, 50).map((t, idx) => (
              <Pressable
                key={t.tokenId}
                onPress={() => onSelect(t)}
                style={[
                  styles.row,
                  idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
                  selectedId === t.tokenId ? { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.08)` } : null,
                ]}
              >
                <Avatar name={t.symbol} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                    {t.symbol}
                    {favorites.has(t.symbol) ? ' ★' : ''}
                  </Text>
                  <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>{t.name}</Text>
                </View>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                  {parseFloat(t.availableBalance).toFixed(6)}
                </Text>
              </Pressable>
            ))
          )}
        </ExchangeCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  list: { paddingVertical: 0, paddingHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
});
