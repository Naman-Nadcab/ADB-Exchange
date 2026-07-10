import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, SegmentControl } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useP2PReferencePrice } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdPrice'>;

export function PostAdPriceScreen({ navigation }: Props) {
  const draft = useP2PStore((s) => s.postAdDraft);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);
  const [pricing, setPricing] = useState(draft.pricing_type ?? 'fixed');
  const refQ = useP2PReferencePrice(draft.currency ?? 'USDT', draft.fiat ?? 'INR');

  useEffect(() => {
    analytics.screen('S-604');
  }, []);

  return (
    <ScreenLayout testID="S-604">
      <ScrollView>
        <SegmentControl
          tabs={[
            { id: 'fixed', label: 'Fixed' },
            { id: 'floating', label: 'Floating' },
          ]}
          active={pricing}
          onChange={(id) => {
            const pt = id as 'fixed' | 'floating';
            setPricing(pt);
            setDraft({ pricing_type: pt });
          }}
        />
        <TextField label="Crypto" value={draft.currency ?? 'USDT'} onChangeText={(v) => setDraft({ currency: v })} />
        <TextField label="Fiat" value={draft.fiat ?? 'INR'} onChangeText={(v) => setDraft({ fiat: v })} />
        {refQ.data ? <Text style={{ marginBottom: 12 }}>Reference: {refQ.data.reference_price}</Text> : null}
        <TextField label="Price" value={draft.price ?? ''} onChangeText={(v) => setDraft({ price: v })} keyboardType="decimal-pad" />
        {pricing === 'floating' ? (
          <TextField
            label="Margin %"
            value={String(draft.float_margin_percent ?? '')}
            onChangeText={(v) => setDraft({ float_margin_percent: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
          />
        ) : null}
        <TextField label="Min amount" value={draft.min_amount ?? ''} onChangeText={(v) => setDraft({ min_amount: v })} keyboardType="decimal-pad" />
        <TextField label="Max amount" value={draft.max_amount ?? ''} onChangeText={(v) => setDraft({ max_amount: v })} keyboardType="decimal-pad" />
        <TextField label="Available" value={draft.available_amount ?? ''} onChangeText={(v) => setDraft({ available_amount: v })} keyboardType="decimal-pad" />
        <TextField label="Payment window (min)" value={String(draft.payment_time_limit ?? 15)} onChangeText={(v) => setDraft({ payment_time_limit: parseInt(v, 10) || 15 })} keyboardType="number-pad" />
        <TextField label="Auto reply" value={draft.auto_reply ?? ''} onChangeText={(v) => setDraft({ auto_reply: v })} />
        <PrimaryButton title="Next: Payment methods" onPress={() => navigation.navigate('PostAdPayment')} />
      </ScrollView>
    </ScreenLayout>
  );
}
