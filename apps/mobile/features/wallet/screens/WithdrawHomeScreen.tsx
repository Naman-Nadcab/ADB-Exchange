import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SkeletonList, EmptyState, ErrorState, ErrorBanner, Avatar } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { POPULAR_DEPOSIT_COINS } from '@core/domain/wallet/deposit';
import { useDepositTokens } from '../hooks/useBlockchainWallet';
import { WithdrawFlowHeader } from '../components/WithdrawFlowHeader';
import { WithdrawTypeNav } from '../components/WithdrawTypeNav';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawHome'>;

export function WithdrawHomeScreen({ navigation, route }: Props) {
  const coinParam = route.params?.coin;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [search, setSearch] = useState('');
  const q = useDepositTokens();

  useEffect(() => {
    analytics.screen('S-520');
  }, []);

  useEffect(() => {
    if (!coinParam || !q.data?.length) return;
    const matched = q.data.find((t) => t.symbol.toUpperCase() === coinParam.toUpperCase());
    if (matched) {
      navigation.navigate('WithdrawNetwork', { symbol: matched.symbol, name: matched.name });
    }
  }, [coinParam, q.data, navigation]);

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
    <ScreenLayout testID="S-520">
      <WithdrawFlowHeader symbol="—" name="Withdraw crypto" step="Step 1 · Choose coin" />
      <WithdrawTypeNav
        active="crypto"
        onCrypto={() => undefined}
        onFiat={() => navigation.navigate('FiatWithdraw')}
      />
      {!isOnline ? <ErrorBanner message="Offline — coin list may be stale" onRetry={onRefresh} /> : null}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin" />
      <Pressable onPress={() => navigation.navigate('WithdrawalHistory')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Withdrawal History</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('AddressBook')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Address Book</Text>
      </Pressable>

      {popular.length > 0 ? (
        <View style={styles.chips}>
          {popular.map((token) =>
            token ? (
              <Pressable
                key={token.id}
                onPress={() => navigation.navigate('WithdrawNetwork', { symbol: token.symbol, name: token.name })}
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
        <ErrorState title="Could not load coins" onRetry={onRefresh} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('WithdrawNetwork', { symbol: item.symbol, name: item.name })}
            >
              <Avatar name={item.symbol} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{item.symbol}</Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{item.name}</Text>
              </View>
              {item.min_withdrawal ? (
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>
                  Min {item.min_withdrawal}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No coins found" message="Try another search or check back later." />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  link: { marginVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 44 },
});
