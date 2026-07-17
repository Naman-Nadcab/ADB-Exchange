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
      <Pressable style={[styles.scrim, { backgroundColor: `hsl(${theme.colors.foregroundPrimary} / ${theme.opacity.scrim})` }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              borderColor: `hsl(${theme.colors.borderDefault})`,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing[5],
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { marginBottom: theme.spacing[4] }]}>
            <Text
              style={[
                theme.typography.headingMd,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
              ]}
            >
              {side === 'sell' ? 'Buy' : 'Sell'} {ad.crypto_symbol}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
            </Pressable>
          </View>

          <View
            style={[
              styles.priceBox,
              {
                backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
                borderColor: `hsl(${theme.colors.borderDefault})`,
                borderRadius: theme.radius.md,
                padding: theme.spacing[3],
                marginBottom: theme.spacing[4],
              },
            ]}
          >
            <Text
              style={[
                theme.typography.headingMd,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
              ]}
            >
              {sym}
              {priceFmtModal}
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansMedium },
                ]}
              >
                {' '}
                / {ad.crypto_symbol}
              </Text>
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
              ]}
            >
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

            <Text
              style={[
                theme.typography.labelSm,
                {
                  color: `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: theme.fonts.sansSemiBold,
                  textTransform: 'uppercase',
                  marginBottom: theme.spacing[2],
                  letterSpacing: 0.4,
                },
              ]}
            >
              Payment method
            </Text>
            {pmQ.isLoading ? (
              <SkeletonList rows={2} />
            ) : selectable.length === 0 ? (
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[3] },
                ]}
              >
                No matching method. Add one in Payment Methods first.
              </Text>
            ) : (
              <View style={[styles.pmRow, { gap: theme.spacing[2], marginBottom: theme.spacing[4] }]}>
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
              <Text
                style={[
                  theme.typography.bodySm,
                  {
                    color: `hsl(${theme.colors.statusError})`,
                    marginBottom: theme.spacing[3],
                    fontFamily: theme.fonts.sansSemiBold,
                  },
                ]}
              >
                {err}
              </Text>
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
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderWidth: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceBox: { borderWidth: 1 },
  pmRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
