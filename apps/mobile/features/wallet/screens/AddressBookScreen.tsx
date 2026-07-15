import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet, Alert, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SearchBar, SkeletonList, EmptyState, ErrorBanner, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWithdrawalAddresses, useDeleteAddress } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AddressBook'>;

export function AddressBookScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const selectMode = route.params?.selectMode;
  const [search, setSearch] = useState('');
  const q = useWithdrawalAddresses();
  const del = useDeleteAddress();

  useEffect(() => {
    analytics.screen('S-719');
  }, []);

  const items = useMemo(() => {
    const list = q.data ?? [];
    const sym = route.params?.symbol?.toUpperCase();
    const filtered = sym ? list.filter((a) => (a.asset ?? '').toUpperCase() === sym) : list;
    if (!search.trim()) return filtered;
    const s = search.toLowerCase();
    return filtered.filter(
      (a) =>
        a.asset.toLowerCase().includes(s) ||
        a.address.toLowerCase().includes(s) ||
        (a.note ?? '').toLowerCase().includes(s) ||
        (a.network ?? '').toLowerCase().includes(s),
    );
  }, [q.data, search, route.params?.symbol]);

  const onRefresh = () => void q.refetch();

  const selectAddress = (item: (typeof items)[number]) => {
    if (!selectMode || !route.params?.symbol || !route.params?.name) return;
    navigation.navigate('WithdrawForm', {
      symbol: route.params.symbol,
      name: route.params.name,
      chainId: route.params.chainId,
      chainName: route.params.chainName,
      confirmations: route.params.confirmations,
      prefillAddress: item.address,
      prefillMemo: item.memo ?? '',
    });
  };

  return (
    <ScreenLayout testID="S-719">
      {!isOnline ? <ErrorBanner message="Offline — address book may be stale" onRetry={onRefresh} /> : null}
      {selectMode ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8, fontSize: 13 }}>
          Tap an address to use it for withdrawal
        </Text>
      ) : null}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search addresses" />
      {!selectMode ? <PrimaryButton title="Add Address" onPress={() => navigation.navigate('AddAddress')} /> : null}

      {q.isLoading && !q.data ? (
        <SkeletonList rows={6} />
      ) : q.isError ? (
        <ErrorState title="Could not load addresses" onRetry={onRefresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => (selectMode ? selectAddress(item) : navigation.navigate('EditAddress', { id: item.id }))}
              onLongPress={
                selectMode
                  ? undefined
                  : () =>
                      Alert.alert('Delete address?', item.note ?? item.address, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => del.mutate(item.id) },
                      ])
              }
            >
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {item.note ?? item.asset} {item.is_whitelisted ? '★' : ''}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                {item.network} · {item.address.slice(0, 16)}…
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No saved addresses" message="Add a withdrawal address to use it quickly." />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, minHeight: 44 },
});
