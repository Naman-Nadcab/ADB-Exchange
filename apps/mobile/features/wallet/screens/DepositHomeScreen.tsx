import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SkeletonList, EmptyState, ErrorState, ErrorBanner, Avatar } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { POPULAR_DEPOSIT_COINS } from '@core/domain/wallet/deposit';
import { useDepositTokens } from '../hooks/useBlockchainWallet';
import { DepositFlowHeader } from '../components/DepositFlowHeader';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositHome'>;

export function DepositHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [search, setSearch] = useState('');
  const q = useDepositTokens();

  useEffect(() => {
    analytics.screen('S-510');
  }, []);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((t) => t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s));
  }, [q.data, search]);

  const popular = useMemo(() => {
    const tokens = q.data ?? [];
    return POPULAR_DEPOSIT_COINS.map((sym) => tokens.find((t) => t.symbol.toUpperCase() === sym)).filter(Boolean);
  }, [q.data]);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  return (
    <ScreenLayout testID="S-510">
      <DepositFlowHeader symbol="—" name="Deposit crypto" step="Step 1 · Choose coin" />
      {!isOnline ? <ErrorBanner message="Offline — coin list may be stale" onRetry={onRefresh} /> : null}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin" />
      <Pressable onPress={() => navigation.navigate('DepositHistory')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Deposit History</Text>
      </Pressable>

      {popular.length > 0 ? (
        <View style={styles.chips}>
          {popular.map((token) =>
            token ? (
              <Pressable
                key={token.id}
                onPress={() => navigation.navigate('DepositNetwork', { symbol: token.symbol, name: token.name })}
                style={[styles.chip, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.4)` }]}
              >
                <Avatar name={token.symbol} size="sm" />
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 12 }}>
                  {token.symbol}
                </Text>
              </Pressable>
            ) : null,
          )}
        </View>
      ) : null}

      {q.isLoading && !q.data ? (
        <SkeletonList rows={8} />
      ) : q.isError ? (
        <ErrorState title="Could not load deposit coins" onRetry={onRefresh} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('DepositNetwork', { symbol: item.symbol, name: item.name })}
              accessibilityLabel={`Deposit ${item.symbol}`}
            >
              <Avatar name={item.symbol} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                  {item.symbol}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{item.name}</Text>
              </View>
              {item.min_deposit ? (
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>
                  Min {item.min_deposit}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No coins found"
              message={search.trim() ? 'Try a different search term' : 'Deposit assets will appear when available from your account'}
            />
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  link: { marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 44 },
});
