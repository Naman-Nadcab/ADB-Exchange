import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, SegmentControl, ErrorBanner } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useP2PStore } from '@core/state/p2pStore';
import { useFundingBalances } from '../../wallet/hooks/useWallet';
import {
  buildPriceSuggestions,
  computeFloatingAdPrice,
  formatCreateAdPremiumLabel,
  formatReferencePriceDisplay,
  validateCreateAdStep,
} from '@core/domain/p2p/createAd';
import { formatFiatSymbol, formatP2pFiatPrice } from '@core/domain/p2p/marketplace';
import { useP2PReferencePrice } from '../hooks/useP2P';
import { CreateAdMarketInsights } from '../components/CreateAdMarketInsights';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdPrice'>;

export function PostAdPriceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const draft = useP2PStore((s) => s.postAdDraft);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);
  const [pricing, setPricing] = useState<'fixed' | 'floating'>(draft.pricing_type ?? 'fixed');
  const [localErr, setLocalErr] = useState<string | null>(null);

  const refQ = useP2PReferencePrice(draft.currency ?? 'USDT', draft.fiat ?? 'INR');
  const balancesQ = useFundingBalances();

  useEffect(() => {
    analytics.screen('S-604');
  }, []);

  const referencePrice = useMemo(() => {
    const raw = refQ.data?.reference_price;
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [refQ.data]);

  const availableBalance = useMemo(() => {
    if (draft.type !== 'sell') return null;
    const row = balancesQ.data?.balances.find((b) => b.symbol === draft.currency);
    if (!row?.available_balance) return null;
    const n = parseFloat(row.available_balance);
    return Number.isFinite(n) ? n : null;
  }, [balancesQ.data, draft.currency, draft.type]);

  const sym = formatFiatSymbol(draft.fiat ?? 'INR');
  const suggestions = buildPriceSuggestions(draft.type ?? 'sell', referencePrice);
  const floatingPrice = computeFloatingAdPrice(referencePrice, draft.float_margin_percent);
  const premiumLabel = formatCreateAdPremiumLabel({ ...draft, pricing_type: pricing }, referencePrice);
  const stepErr = validateCreateAdStep('price', { ...draft, pricing_type: pricing }, referencePrice, availableBalance);

  const onNext = () => {
    setLocalErr(null);
    const err = validateCreateAdStep('price', { ...draft, pricing_type: pricing }, referencePrice, availableBalance);
    if (err) {
      setLocalErr(err);
      return;
    }
    if (pricing === 'floating' && floatingPrice != null) {
      setDraft({ pricing_type: 'floating', price: floatingPrice.toFixed(4) });
    } else {
      setDraft({ pricing_type: 'fixed' });
    }
    navigation.navigate('PostAdPayment');
  };

  return (
    <ScreenLayout testID="S-604">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!isOnline ? <ErrorBanner message="Offline — reference price may be unavailable." onRetry={() => void refQ.refetch()} /> : null}

        <SegmentControl
          tabs={[
            { id: 'fixed', label: 'Fixed price' },
            { id: 'floating', label: 'Floating price' },
          ]}
          active={pricing}
          onChange={(id) => {
            const pt = id as 'fixed' | 'floating';
            setPricing(pt);
            setDraft({ pricing_type: pt });
          }}
        />

        <CreateAdMarketInsights draft={draft} referencePrice={referencePrice} />

        {pricing === 'fixed' && suggestions ? (
          <View style={[styles.suggestBox, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: `hsl(${theme.colors.brandPrimary})`, marginBottom: 8 }}>
              Smart Price Suggestions
            </Text>
            <View style={styles.suggestRow}>
              {[
                { label: 'Best Price', val: suggestions.bestPrice },
                { label: 'Market', val: suggestions.competitive },
                { label: 'Fast Fill', val: suggestions.fastFill },
              ].map(({ label, val }) => (
                <Pressable
                  key={label}
                  style={[styles.suggestChip, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
                  onPress={() => {
                    void hapticLight();
                    setDraft({ price: val.toFixed(4) });
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                    {sym}{formatP2pFiatPrice(String(val), draft.fiat ?? 'INR')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {pricing === 'floating' ? (
          <View style={[styles.floatBox, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.3)` }]}>
            <View style={styles.floatRow}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Reference price</Text>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {formatReferencePriceDisplay(draft.fiat ?? 'INR', referencePrice)}
              </Text>
            </View>
            <TextField
              label="Margin %"
              value={String(draft.float_margin_percent ?? 0)}
              onChangeText={(v) => setDraft({ float_margin_percent: parseFloat(v) || 0 })}
              keyboardType="decimal-pad"
            />
            {floatingPrice != null ? (
              <Text style={{ fontSize: 13, color: `hsl(${theme.colors.foregroundPrimary})` }}>
                Your ad price: {sym}{formatP2pFiatPrice(String(floatingPrice), draft.fiat ?? 'INR')}
                {premiumLabel ? ` · ${premiumLabel}` : ''}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <TextField
              label={`Price (${draft.fiat} per 1 ${draft.currency})`}
              value={draft.price ?? ''}
              onChangeText={(v) => setDraft({ price: v })}
              keyboardType="decimal-pad"
              placeholder={referencePrice != null ? formatP2pFiatPrice(String(referencePrice), draft.fiat ?? 'INR') : undefined}
            />
            {premiumLabel ? (
              <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>
                {premiumLabel}
              </Text>
            ) : null}
          </>
        )}

        {draft.type === 'sell' && availableBalance != null ? (
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>
            Available balance: {availableBalance} {draft.currency}
          </Text>
        ) : null}

        <TextField label={`Min (${draft.fiat})`} value={draft.min_amount ?? ''} onChangeText={(v) => setDraft({ min_amount: v })} keyboardType="decimal-pad" />
        <TextField label={`Max (${draft.fiat})`} value={draft.max_amount ?? ''} onChangeText={(v) => setDraft({ max_amount: v })} keyboardType="decimal-pad" />
        <TextField
          label={`Total available (${draft.currency})`}
          value={draft.available_amount ?? ''}
          onChangeText={(v) => setDraft({ available_amount: v })}
          keyboardType="decimal-pad"
        />

        {localErr || stepErr ? <ErrorBanner message={localErr ?? stepErr!} /> : null}

        <PrimaryButton title="Next: Payment settings" disabled={!!stepErr} onPress={onNext} style={{ marginTop: 12 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  suggestBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  suggestRow: { flexDirection: 'row', gap: 8 },
  suggestChip: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 8 },
  floatBox: { borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  floatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
