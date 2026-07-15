import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, Modal, View, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SearchBar,
  SkeletonList,
  PrimaryButton,
  TextField,
  FilterChip,
  AccountEntryButton,
} from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useP2PAds, useP2PSubscriptions } from '../hooks/useP2P';
import { useGuestAccess } from '@features/auth';
import { P2PAdCard } from '../components/P2PAdCard';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'Marketplace'>;

const SIDE_TABS = [
  { id: 'sell', label: 'Buy' },
  { id: 'buy', label: 'Sell' },
];

const TOOLBAR = [
  { id: 'filters', label: 'Filters', icon: 'options-outline' as const },
  { id: 'orders', label: 'Orders', icon: 'receipt-outline' as const },
  { id: 'ads', label: 'My Ads', icon: 'megaphone-outline' as const },
  { id: 'payments', label: 'Payments', icon: 'card-outline' as const },
];

export function MarketplaceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { requireAuth } = useGuestAccess();
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

  const onToolbar = (id: string) => {
    void hapticLight();
    if (id === 'filters') setShowFilters(true);
    else if (!requireAuth()) return;
    else if (id === 'orders') navigation.navigate('OrdersList');
    else if (id === 'ads') navigation.navigate('MyAds');
    else if (id === 'payments') navigation.navigate('PaymentMethods');
  };

  return (
    <ScreenLayout testID="S-600">
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>P2P</Text>
          <Text style={[styles.heroSub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Peer-to-peer marketplace
          </Text>
        </View>
        <AccountEntryButton />
      </View>

      <View style={styles.sideRow}>
        {SIDE_TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setSide(t.id)}
            style={[
              styles.sideBtn,
              {
                backgroundColor:
                  side === t.id ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.surfaceMuted})`,
                borderColor:
                  side === t.id ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.borderDefault})`,
              },
            ]}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 14,
                color:
                  side === t.id
                    ? `hsl(${theme.colors.brandPrimaryForeground})`
                    : `hsl(${theme.colors.foregroundPrimary})`,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.assetRow}>
        <FilterChip label={crypto} selected onPress={() => setShowFilters(true)} />
        <FilterChip label={fiat} selected onPress={() => setShowFilters(true)} />
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search merchant or coin" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
        {TOOLBAR.map((item) => (
          <Pressable key={item.id} onPress={() => onToolbar(item.id)} style={[styles.toolBtn, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
            <Ionicons name={item.icon} size={16} color={`hsl(${theme.colors.brandPrimary})`} />
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

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
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 32, color: `hsl(${theme.colors.foregroundSecondary})` }}>
              No ads available
            </Text>
          }
        />
      )}

      <PrimaryButton
        title="Post Ad"
        onPress={() => {
          if (!requireAuth()) return;
          navigation.navigate('PostAdType');
        }}
        style={{ marginTop: 8 }}
      />

      <Modal visible={showFilters} transparent animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => setShowFilters(false)}>
          <Pressable style={[styles.modal, { backgroundColor: `hsl(${theme.colors.backgroundElevated})`, borderColor: `hsl(${theme.colors.borderDefault})` }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Filters</Text>
            <TextField label="Fiat" value={fiat} onChangeText={setFiat} />
            <TextField label="Crypto" value={crypto} onChangeText={setCrypto} />
            <PrimaryButton title="Apply" onPress={() => { setShowFilters(false); void q.refetch(); }} />
            <PrimaryButton title="Close" variant="secondary" onPress={() => setShowFilters(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  heroTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  heroSub: { fontSize: 13, marginBottom: 12 },
  sideRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sideBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  assetRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toolbar: { marginBottom: 10, maxHeight: 44 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 36,
  },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  modalTitle: { fontWeight: '700', fontSize: 18, marginBottom: 12 },
});
