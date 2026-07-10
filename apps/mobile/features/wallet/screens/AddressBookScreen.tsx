import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SearchBar } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useWithdrawalAddresses, useDeleteAddress } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AddressBook'>;

export function AddressBookScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const q = useWithdrawalAddresses();
  const del = useDeleteAddress();

  useEffect(() => {
    analytics.screen('S-719');
  }, []);

  const items = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (a) =>
        a.asset.toLowerCase().includes(s) ||
        a.address.toLowerCase().includes(s) ||
        (a.note ?? '').toLowerCase().includes(s) ||
        (a.network ?? '').toLowerCase().includes(s),
    );
  }, [q.data, search]);

  return (
    <ScreenLayout testID="S-719">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search addresses" />
      <PrimaryButton title="Add Address" onPress={() => navigation.navigate('AddAddress')} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('EditAddress', { id: item.id })}
            onLongPress={() =>
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
        ListEmptyComponent={<Text style={{ marginTop: 24, textAlign: 'center' }}>No saved addresses</Text>}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, minHeight: 44 },
});
