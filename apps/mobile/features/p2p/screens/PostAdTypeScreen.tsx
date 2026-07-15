import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SegmentControl, FilterChip, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { MARKETPLACE_CRYPTOS, MARKETPLACE_FIATS } from '@core/domain/p2p/marketplace';
import { validateCreateAdStep } from '@core/domain/p2p/createAd';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdType'>;

export function PostAdTypeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const draft = useP2PStore((s) => s.postAdDraft);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);

  useEffect(() => {
    analytics.screen('S-603');
    if (!draft.currency) setDraft({ currency: 'USDT', fiat: 'INR' });
  }, [draft.currency, setDraft]);

  const err = validateCreateAdStep('type', draft, null);

  return (
    <ScreenLayout testID="S-603">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[styles.heading, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Post new ad</Text>
        <Text style={[styles.sub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Create a {draft.type ?? 'sell'} ad for {draft.currency ?? 'USDT'}/{draft.fiat ?? 'INR'}.
        </Text>

        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>I want to</Text>
        <SegmentControl
          tabs={[
            { id: 'sell', label: 'Sell crypto' },
            { id: 'buy', label: 'Buy crypto' },
          ]}
          active={draft.type ?? 'sell'}
          onChange={(id) => setDraft({ type: id as 'buy' | 'sell' })}
        />

        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 16 }]}>Crypto</Text>
        <View style={styles.chips}>
          {MARKETPLACE_CRYPTOS.map((c) => (
            <FilterChip key={c} label={c} selected={draft.currency === c} onPress={() => setDraft({ currency: c })} />
          ))}
        </View>

        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 12 }]}>Fiat</Text>
        <View style={styles.chips}>
          {MARKETPLACE_FIATS.map((f) => (
            <FilterChip key={f} label={f} selected={draft.fiat === f} onPress={() => setDraft({ fiat: f })} />
          ))}
        </View>

        {err ? <ErrorBanner message={err} /> : null}

        <PrimaryButton
          title="Next: Pricing & Limits"
          disabled={!!validateCreateAdStep('type', draft, null)}
          onPress={() => navigation.navigate('PostAdPrice')}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sub: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
