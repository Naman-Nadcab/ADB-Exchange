import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { FilterChip } from '@shared/ui';
import {
  MARKETPLACE_CRYPTOS,
  MARKETPLACE_FIATS,
  PAYMENT_FILTERS,
  type MarketplaceFiltersValue,
} from '@core/domain/p2p/marketplace';

export type { MarketplaceFiltersValue };

type Props = {
  value: MarketplaceFiltersValue;
  onChange: (v: MarketplaceFiltersValue) => void;
  onRefresh?: () => void;
};

export function MarketplaceFilters({ value, onChange, onRefresh }: Props) {
  const { theme } = useTheme();
  const buyColor = '#0ecb81';
  const sellColor = '#f6465d';

  return (
    <View style={styles.wrap}>
      <View style={[styles.sideRow, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        {(['buy', 'sell'] as const).map((s) => {
          const active = value.side === s;
          const color = s === 'buy' ? buyColor : sellColor;
          return (
            <Pressable
              key={s}
              onPress={() => {
                void hapticLight();
                onChange({ ...value, side: s });
              }}
              style={styles.sideTab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.sideLabel, { color: active ? color : `hsl(${theme.colors.foregroundSecondary})` }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
              {active ? <View style={[styles.sideUnderline, { backgroundColor: color }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cryptoRow}>
        {MARKETPLACE_CRYPTOS.map((c) => (
          <FilterChip
            key={c}
            label={c}
            selected={value.crypto === c}
            onPress={() => onChange({ ...value, crypto: c })}
          />
        ))}
      </ScrollView>

      <View style={styles.dropdownRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fiatRow}>
          {MARKETPLACE_FIATS.map((f) => (
            <FilterChip
              key={f}
              label={f}
              selected={value.fiat === f}
              onPress={() => onChange({ ...value, fiat: f })}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentRow}>
        {PAYMENT_FILTERS.map((p) => (
          <FilterChip
            key={p.value || 'all'}
            label={p.label}
            selected={value.paymentCode === p.value}
            onPress={() => onChange({ ...value, paymentCode: p.value })}
          />
        ))}
        {onRefresh ? (
          <Pressable
            onPress={() => {
              void hapticLight();
              onRefresh();
            }}
            style={[
              styles.refreshBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              },
            ]}
            accessibilityLabel="Refresh"
          >
            <Ionicons name="refresh" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 4 },
  sideRow: { flexDirection: 'row', gap: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  sideTab: { paddingBottom: 10, minWidth: 48, alignItems: 'center' },
  sideLabel: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  sideUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  cryptoRow: { gap: 8, paddingVertical: 2 },
  dropdownRow: { flexDirection: 'row', alignItems: 'center' },
  fiatRow: { gap: 8 },
  paymentRow: { gap: 8, alignItems: 'center', paddingBottom: 2 },
  refreshBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
