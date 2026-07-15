import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import type { MergedAsset } from '@core/domain/wallet/portfolio';

type Props = {
  asset: MergedAsset;
  isFavorite?: boolean;
  showBalances?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onTrade?: () => void;
};

function AssetRowInner({
  asset,
  isFavorite,
  showBalances = true,
  onPress,
  onToggleFavorite,
  onDeposit,
  onWithdraw,
  onTrade,
}: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const hasActions = onDeposit || onWithdraw || onTrade;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${asset.symbol} balance`}
      >
        <View style={styles.left}>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
            {asset.symbol}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {asset.name}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
            ${mask(formatUsd(asset.usdValue))}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            {mask(asset.totalBalance)} {asset.symbol}
          </Text>
        </View>
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={8} accessibilityLabel="Toggle favorite asset">
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>{isFavorite ? '★' : '☆'}</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {hasActions ? (
        <View style={styles.actions}>
          {onTrade ? (
            <Pressable onPress={onTrade} style={[styles.actionBtn, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '700' }}>Trade</Text>
            </Pressable>
          ) : null}
          {onDeposit ? (
            <Pressable onPress={onDeposit} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, borderWidth: StyleSheet.hairlineWidth }]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600' }}>Deposit</Text>
            </Pressable>
          ) : null}
          {onWithdraw ? (
            <Pressable onPress={onWithdraw} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, borderWidth: StyleSheet.hairlineWidth }]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600' }}>Withdraw</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const AssetRow = memo(AssetRowInner);

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, minHeight: 44 },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', marginRight: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, paddingBottom: 8, paddingLeft: 4 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minHeight: 32, justifyContent: 'center' },
});
