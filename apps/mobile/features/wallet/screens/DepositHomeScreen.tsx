import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useDepositTokens } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';
import type { DepositToken } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositHome'>;

export function DepositHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const q = useDepositTokens();

  useEffect(() => {
    analytics.screen('S-510');
  }, []);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((t: DepositToken) => t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <ScreenLayout testID="S-510">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search coin" />
      <Pressable onPress={() => navigation.navigate('DepositHistory')} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Deposit History</Text>
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
              onPress={() => navigation.navigate('DepositNetwork', { symbol: item.symbol, name: item.name })}
              accessibilityLabel={`Deposit ${item.symbol}`}
            >
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>
                {item.symbol}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No coins found</Text>}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  link: { marginVertical: 8 },
  row: { paddingVertical: 14, minHeight: 44 },
});
