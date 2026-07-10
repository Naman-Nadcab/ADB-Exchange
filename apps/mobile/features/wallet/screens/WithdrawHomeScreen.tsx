import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useDepositTokens } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawHome'>;

export function WithdrawHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const q = useDepositTokens();

  useEffect(() => {
    analytics.screen('S-520');
  }, []);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((t) => t.symbol.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <ScreenLayout testID="S-520">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin" />
      <Pressable onPress={() => navigation.navigate('WithdrawalHistory')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Withdrawal History</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('AddressBook')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Address Book</Text>
      </Pressable>
      {q.isLoading ? (
        <SkeletonList rows={8} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('WithdrawForm', { symbol: item.symbol, name: item.name })}
            >
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {item.symbol}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  link: { marginVertical: 6 },
  row: { paddingVertical: 14, minHeight: 44 },
});
