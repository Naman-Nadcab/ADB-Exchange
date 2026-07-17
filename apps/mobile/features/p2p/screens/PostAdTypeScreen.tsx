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
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[6] }}>
        <Text
          style={[
            theme.typography.headingLg,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[1.5] },
          ]}
        >
          Post new ad
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[4] },
          ]}
        >
          Create a {draft.type ?? 'sell'} ad for {draft.currency ?? 'USDT'}/{draft.fiat ?? 'INR'}.
        </Text>

        <Text
          style={[
            theme.typography.labelSm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansBold,
              textTransform: 'uppercase',
              marginBottom: theme.spacing[2],
              letterSpacing: 0.4,
            },
          ]}
        >
          I want to
        </Text>
        <SegmentControl
          tabs={[
            { id: 'sell', label: 'Sell crypto' },
            { id: 'buy', label: 'Buy crypto' },
          ]}
          active={draft.type ?? 'sell'}
          onChange={(id) => setDraft({ type: id as 'buy' | 'sell' })}
        />

        <Text
          style={[
            theme.typography.labelSm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansBold,
              textTransform: 'uppercase',
              marginTop: theme.spacing[4],
              marginBottom: theme.spacing[2],
              letterSpacing: 0.4,
            },
          ]}
        >
          Crypto
        </Text>
        <View style={[styles.chips, { gap: theme.spacing[2] }]}>
          {MARKETPLACE_CRYPTOS.map((c) => (
            <FilterChip key={c} label={c} selected={draft.currency === c} onPress={() => setDraft({ currency: c })} />
          ))}
        </View>

        <Text
          style={[
            theme.typography.labelSm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansBold,
              textTransform: 'uppercase',
              marginTop: theme.spacing[3],
              marginBottom: theme.spacing[2],
              letterSpacing: 0.4,
            },
          ]}
        >
          Fiat
        </Text>
        <View style={[styles.chips, { gap: theme.spacing[2] }]}>
          {MARKETPLACE_FIATS.map((f) => (
            <FilterChip key={f} label={f} selected={draft.fiat === f} onPress={() => setDraft({ fiat: f })} />
          ))}
        </View>

        {err ? <ErrorBanner message={err} /> : null}

        <PrimaryButton
          title="Next: Pricing & Limits"
          disabled={!!validateCreateAdStep('type', draft, null)}
          onPress={() => navigation.navigate('PostAdPrice')}
          style={{ marginTop: theme.spacing[5] }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
