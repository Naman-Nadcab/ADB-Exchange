import { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatUsd } from '@core/domain/wallet/portfolio';
import type { MergedAsset } from '@core/domain/wallet/portfolio';

type Props = {
  asset: MergedAsset;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
};

function AssetRowInner({ asset, isFavorite, onPress, onToggleFavorite }: Props) {
  const { theme } = useTheme();

  return (
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
          ${formatUsd(asset.usdValue)}
        </Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
          {asset.totalBalance} {asset.symbol}
        </Text>
      </View>
      {onToggleFavorite ? (
        <Pressable onPress={onToggleFavorite} hitSlop={8} accessibilityLabel="Toggle favorite asset">
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>{isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export const AssetRow = memo(AssetRowInner);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8, minHeight: 44 },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', marginRight: 8 },
});
