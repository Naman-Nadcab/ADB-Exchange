import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, Modal, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SearchBar, SegmentControl, SkeletonList, PrimaryButton, TextField } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useP2PAds, useP2PSubscriptions } from '../hooks/useP2P';
import { P2PAdCard } from '../components/P2PAdCard';
import type { P2PStackParamList } from '../navigation/types';

const SIDES = [
  { id: 'sell', label: 'Buy' },
  { id: 'buy', label: 'Sell' },
];

type Props = NativeStackScreenProps<P2PStackParamList, 'Marketplace'>;

export function MarketplaceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [side, setSide] = useState('sell');
  const [search, setSearch] = useState('');
  const [fiat, setFiat] = useState('INR');
  const [crypto, setCrypto] = useState('USDT');
  const [showFilters, setShowFilters] = useState(false);
  const favorites = useP2PStore((s) => s.favoriteAdIds);
  const toggleFavorite = useP2PStore((s) => s.toggleFavorite);

  useP2PSubscriptions();

  const q = useP2PAds({ type: side, currency: crypto, fiat });
  useEffect(() => {
    analytics.screen('S-600');
  }, []);

  const items = useMemo(() => {
    const all = q.data?.pages.flat() ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter((a) => a.username.toLowerCase().includes(s) || a.crypto_symbol.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <ScreenLayout testID="S-600">
      <SegmentControl tabs={SIDES} active={side} onChange={setSide} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search merchant or coin" />
      <View style={styles.links}>
        <Pressable onPress={() => setShowFilters(true)}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>Filters</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('OrdersList')}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>Orders</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('MyAds')}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>My Ads</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('PaymentMethods')}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>Payments</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('MerchantDashboard')}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>Merchant</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('BlockedAdvertisers')}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>Blocked</Text>
        </Pressable>
      </View>
      {q.isLoading ? (
        <SkeletonList rows={8} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <P2PAdCard
              ad={item}
              isFavorite={favorites.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onPress={() => navigation.navigate('AdDetail', { adId: item.id })}
            />
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No ads</Text>}
        />
      )}
      <PrimaryButton title="Post Ad" onPress={() => navigation.navigate('PostAdType')} />
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Filters (BS-600)</Text>
          <TextField label="Fiat" value={fiat} onChangeText={setFiat} />
          <TextField label="Crypto" value={crypto} onChangeText={setCrypto} />
          <PrimaryButton title="Apply" onPress={() => { setShowFilters(false); void q.refetch(); }} />
          <PrimaryButton title="Close" variant="secondary" onPress={() => setShowFilters(false)} />
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', gap: 16, marginVertical: 8, flexWrap: 'wrap' },
  modal: { marginTop: 'auto', backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontWeight: '700', marginBottom: 12 },
});
