import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel, SkeletonList } from '@shared/ui';
import { formatMarketCap, formatSupply } from '@core/domain/markets/formatPrice';
import type { CoinInfo } from '@exchange/mobile-types';

type Props = {
  coin?: CoinInfo | null;
  isLoading?: boolean;
};

function LinkRow({ label, url }: { label: string; url?: string }) {
  const { theme } = useTheme();
  if (!url) return null;
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      style={styles.linkRow}
      accessibilityRole="link"
    >
      <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }} numberOfLines={1}>
        {url.replace(/^https?:\/\//, '')}
      </Text>
    </Pressable>
  );
}

export function CoinAboutSection({ coin, isLoading }: Props) {
  const { theme } = useTheme();
  if (isLoading && !coin) return <SkeletonList rows={4} />;
  if (!coin) return null;

  return (
    <TerminalPanel style={{ marginBottom: 16 }}>
      <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, marginBottom: 8 }]}>
        About {coin.name ?? coin.symbol}
      </Text>
      {coin.description ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
          {coin.description}
        </Text>
      ) : null}
      <View style={styles.statsGrid}>
        {coin.market_cap != null ? (
          <Stat label="Market Cap" value={formatMarketCap(coin.market_cap)} theme={theme} />
        ) : null}
        {coin.market_cap_rank != null ? (
          <Stat label="Rank" value={`#${coin.market_cap_rank}`} theme={theme} />
        ) : null}
        {coin.circulating_supply != null ? (
          <Stat label="Circulating" value={formatSupply(coin.circulating_supply)} theme={theme} />
        ) : null}
        {coin.total_supply != null ? (
          <Stat label="Total Supply" value={formatSupply(coin.total_supply)} theme={theme} />
        ) : null}
      </View>
      <LinkRow label="Website" url={coin.homepage} />
      <LinkRow label="Explorer" url={coin.blockchain_site} />
    </TerminalPanel>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.stat}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stat: { flexBasis: '47%', flexGrow: 1 },
  linkRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
});
