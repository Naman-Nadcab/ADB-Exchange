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
  const buyColor = `hsl(${theme.colors.tradeBuy})`;
  const sellColor = `hsl(${theme.colors.tradeSell})`;

  return (
    <View style={[styles.wrap, { gap: theme.spacing[2.5] }]}>
      <View
        style={[
          styles.sideRow,
          { gap: theme.spacing[6], borderBottomColor: `hsl(${theme.colors.borderDefault})` },
        ]}
      >
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
              style={[styles.sideTab, { paddingBottom: theme.spacing[2.5] }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  theme.typography.headingMd,
                  {
                    color: active ? color : `hsl(${theme.colors.foregroundSecondary})`,
                    textTransform: 'capitalize',
                    fontFamily: theme.fonts.sansBold,
                  },
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
              {active ? (
                <View
                  style={[
                    styles.sideUnderline,
                    { backgroundColor: color, borderRadius: theme.radius.sm, height: theme.borderWidth.medium },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.cryptoRow, { gap: theme.spacing[2], paddingVertical: theme.spacing[0.5] }]}
      >
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.fiatRow, { gap: theme.spacing[2] }]}
        >
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.paymentRow,
          { gap: theme.spacing[2], alignItems: 'center', paddingBottom: theme.spacing[0.5] },
        ]}
      >
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
                width: theme.sizes.tapTarget,
                height: 36,
                borderRadius: theme.radius.md,
                borderColor: `hsl(${theme.colors.borderDefault})`,
                backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
                marginLeft: theme.spacing[1],
              },
            ]}
            accessibilityLabel="Refresh"
          >
            <Ionicons name="refresh" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  sideRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  sideTab: { minWidth: 48, alignItems: 'center' },
  sideUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cryptoRow: {},
  dropdownRow: { flexDirection: 'row', alignItems: 'center' },
  fiatRow: {},
  paymentRow: {},
  refreshBtn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
