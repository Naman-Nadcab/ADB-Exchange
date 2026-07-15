import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard, SearchBar, Avatar, SkeletonList, ErrorState } from '@shared/ui';
import type { ConvertCurrency } from '@exchange/mobile-types';
import { POPULAR_DEPOSIT_COINS } from '@core/domain/wallet/deposit';
import { filterConvertCurrencies } from '@core/domain/wallet/convert';
import type { ConvertBalance } from '@exchange/mobile-types';

type Props = {
  label: string;
  subtitle?: string;
  currencies: ConvertCurrency[];
  balances?: ConvertBalance[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  hideZero?: boolean;
  onHideZeroChange?: (v: boolean) => void;
  favorites: Set<string>;
  showBalance?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

export function ConvertAssetPicker({
  label,
  subtitle,
  currencies,
  balances,
  selectedSymbol,
  onSelect,
  search,
  onSearchChange,
  hideZero,
  onHideZeroChange,
  favorites,
  showBalance,
  isLoading,
  isError,
  onRetry,
}: Props) {
  const { theme } = useTheme();
  const balanceMap = new Map((balances ?? []).map((b) => [b.symbol.toUpperCase(), b]));
  const filtered = filterConvertCurrencies(currencies, { search, hideZero, favorites, balances });
  const popular = POPULAR_DEPOSIT_COINS.map((sym) => currencies.find((c) => c.symbol.toUpperCase() === sym)).filter(Boolean);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      {subtitle ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginBottom: 6 }}>{subtitle}</Text>
      ) : null}
      <SearchBar value={search} onChangeText={onSearchChange} placeholder="Search coins..." />
      {onHideZeroChange != null ? (
        <View style={styles.toggleRow}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Hide zero balances</Text>
          <Switch value={!!hideZero} onValueChange={onHideZeroChange} />
        </View>
      ) : null}

      {popular.length ? (
        <View style={styles.chips}>
          {popular.map((c) =>
            c ? (
              <Pressable
                key={c.id}
                onPress={() => onSelect(c.symbol)}
                style={[
                  styles.chip,
                  {
                    borderColor: `hsl(${theme.colors.borderDefault})`,
                    backgroundColor:
                      selectedSymbol === c.symbol ? `hsl(${theme.colors.brandPrimary} / 0.12)` : `hsl(${theme.colors.surfaceMuted} / 0.4)`,
                  },
                ]}
              >
                <Avatar name={c.symbol} size="sm" />
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 11 }}>
                  {c.symbol}
                  {favorites.has(c.symbol) ? ' ★' : ''}
                </Text>
              </Pressable>
            ) : null,
          )}
        </View>
      ) : null}

      {isLoading && !currencies.length ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState title="Could not load assets" onRetry={onRetry} />
      ) : (
        <ExchangeCard variant="terminal" style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={{ padding: 16, color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>No coins found</Text>
          ) : (
            filtered.slice(0, 50).map((c, idx) => {
              const bal = balanceMap.get(c.symbol.toUpperCase());
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c.symbol)}
                  style={[
                    styles.row,
                    idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
                    selectedSymbol === c.symbol ? { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.08)` } : null,
                  ]}
                >
                  <Avatar name={c.symbol} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                      {c.symbol}
                      {favorites.has(c.symbol) ? ' ★' : ''}
                    </Text>
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>{c.name}</Text>
                  </View>
                  {showBalance && bal ? (
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                      {parseFloat(bal.available_balance).toFixed(6)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ExchangeCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  list: { paddingVertical: 0, paddingHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
});
