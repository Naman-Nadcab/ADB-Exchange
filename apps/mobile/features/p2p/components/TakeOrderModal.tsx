import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { PrimaryButton, TextField, SkeletonList, FilterChip } from '@shared/ui';
import { ApiError } from '@core/api/errors/ApiError';
import { validateOrderQuantity, getAdSide, getAdPrice } from '@core/domain/p2p/order';
import {
  formatFiatSymbol,
  formatP2pFiatPrice,
  marketplaceErrorMessage,
} from '@core/domain/p2p/marketplace';
import type { P2PAd } from '@exchange/mobile-types';
import { useCreateP2POrder, useMyPaymentMethods } from '../hooks/useP2P';

type Props = {
  ad: P2PAd;
  fiat: string;
  visible: boolean;
  onClose: () => void;
  onCreated: (orderId: string) => void;
};

export function TakeOrderModal({ ad, fiat, visible, onClose, onCreated }: Props) {
  const { theme } = useTheme();
  const sym = formatFiatSymbol(fiat);
  const side = getAdSide(ad);
  const rawPrice = getAdPrice(ad);
  const priceFmtModal = formatP2pFiatPrice(rawPrice, fiat);
  const min = ad.min_amount ?? '0';
  const max = ad.max_amount ?? '0';
  const pmQ = useMyPaymentMethods();
  const create = useCreateP2POrder();
  const selectable = useMemo(() => {
    const methods = (pmQ.data ?? []).filter((m) => m.is_active !== false);
    const acceptedIds = ad.accepted_platform_method_ids ?? [];
    if (!acceptedIds.length) return methods;
    const set = new Set(acceptedIds);
    return methods.filter((m) => m.payment_method_id && set.has(m.payment_method_id));
  }, [pmQ.data, ad.accepted_platform_method_ids]);

  const [qty, setQty] = useState(min);
  const [pmId, setPmId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQty(min);
      setPmId('');
      setErr(null);
    }
  }, [visible, min, ad.id]);

  useEffect(() => {
    if (selectable.length === 1 && !pmId) setPmId(selectable[0]!.id);
  }, [selectable, pmId]);

  const submit = async () => {
    setErr(null);
    const validation = validateOrderQuantity(qty.trim(), min, max, ad.available_amount);
    if (validation) {
      setErr(validation);
      return;
    }
    if (!pmId) {
      setErr('Select a payment method');
      return;
    }
    try {
      const order = await create.mutateAsync({ adId: ad.id, quantity: qty.trim(), paymentMethodId: pmId });
      onCreated(order.id);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : marketplaceErrorMessage(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              borderColor: `hsl(${theme.colors.borderDefault})`,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {side === 'sell' ? 'Buy' : 'Sell'} {ad.crypto_symbol}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={`hsl(${theme.colors.foregroundSecondary})`} />
            </Pressable>
          </View>

          <View style={[styles.priceBox, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`, borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 18, fontWeight: '700' }}>
              {sym}
              {priceFmtModal}
              <Text style={{ fontSize: 13, fontWeight: '500', color: `hsl(${theme.colors.foregroundSecondary})` }}>
                {' '}
                / {ad.crypto_symbol}
              </Text>
            </Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 4 }}>
              Limits {sym}
              {formatP2pFiatPrice(min, fiat)} – {sym}
              {formatP2pFiatPrice(max, fiat)}
            </Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <TextField
              label={`Amount (${ad.crypto_symbol})`}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Payment method</Text>
            {pmQ.isLoading ? (
              <SkeletonList rows={2} />
            ) : selectable.length === 0 ? (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12, fontSize: 13 }}>
                No matching method. Add one in Payment Methods first.
              </Text>
            ) : (
              <View style={styles.pmRow}>
                {selectable.map((m) => (
                  <FilterChip
                    key={m.id}
                    label={m.display_name || m.method_name}
                    selected={pmId === m.id}
                    onPress={() => {
                      void hapticLight();
                      setPmId(m.id);
                    }}
                  />
                ))}
              </View>
            )}

            {err ? (
              <Text style={{ color: '#f6465d', fontSize: 13, marginBottom: 12, fontWeight: '600' }}>{err}</Text>
            ) : null}

            <PrimaryButton
              title={create.isPending ? 'Creating…' : 'Create Order'}
              loading={create.isPending}
              disabled={!pmId || selectable.length === 0}
              onPress={() => void submit()}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  priceBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.4 },
  pmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
});
