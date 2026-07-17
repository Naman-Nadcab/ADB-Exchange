import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner, TextField, SecondaryButton, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useP2PStore } from '@core/state/p2pStore';
import { ApiError } from '@core/api/errors/ApiError';
import {
  buildCreateAdPayload,
  validateCreateAdDraft,
  CREATE_AD_AUTO_REPLY_MAX,
  CREATE_AD_REMARKS_MAX,
} from '@core/domain/p2p/createAd';
import { marketplaceErrorMessage } from '@core/domain/p2p/marketplace';
import { useP2PReferencePrice } from '../hooks/useP2P';
import { useCreateAdSubmit } from '../hooks/useCreateAdSubmit';
import { CreateAdPreview } from '../components/CreateAdPreview';
import { CreateAdMarketInsights } from '../components/CreateAdMarketInsights';
import { AdDetailEscrowBanner } from '../components/AdDetailSections';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdReview'>;

export function PostAdReviewScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const draft = useP2PStore((s) => s.postAdDraft);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);
  const clearDraft = useP2PStore((s) => s.clearPostAdDraft);
  const { submit } = useCreateAdSubmit();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const publishedRef = useRef(false);

  const refQ = useP2PReferencePrice(draft.currency ?? 'USDT', draft.fiat ?? 'INR');

  useEffect(() => {
    analytics.screen('S-606');
  }, []);

  const referencePrice = useMemo(() => {
    const raw = refQ.data?.reference_price;
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [refQ.data]);

  const validationErr = validateCreateAdDraft(draft, referencePrice);

  const publish = async () => {
    if (publishedRef.current || loading) return;
    if (!isOnline) {
      setError('Offline — connect to publish your ad');
      return;
    }
    const err = validateCreateAdDraft(draft, referencePrice);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);
    publishedRef.current = true;
    try {
      const body = buildCreateAdPayload(draft, referencePrice);
      const ad = await submit(body);
      setSuccess(true);
      clearDraft();
      navigation.replace('AdDetail', { adId: ad.id, ad });
    } catch (e) {
      publishedRef.current = false;
      if (e instanceof ApiError && e.code === 'DUPLICATE_SUBMIT') {
        setError('Please wait — publish already in progress');
      } else {
        setError(e instanceof ApiError ? e.message : marketplaceErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ScreenLayout testID="S-606">
        <Text
          style={[
            theme.typography.bodyMd,
            { textAlign: 'center', marginTop: theme.spacing[10], fontFamily: theme.fonts.sansBold },
          ]}
        >
          Ad published
        </Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-606">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!isOnline ? <ErrorBanner message="Offline — cannot publish until reconnected." /> : null}
        <AdDetailEscrowBanner />

        <CreateAdMarketInsights draft={draft} referencePrice={referencePrice} />
        <CreateAdPreview
          draft={draft}
          referencePrice={referencePrice}
          paymentMethodCount={draft.payment_method_ids?.length ?? 0}
        />

        <TextField
          label="Terms / Remarks"
          value={draft.remarks ?? ''}
          onChangeText={(v) => setDraft({ remarks: v.slice(0, CREATE_AD_REMARKS_MAX) })}
          multiline
          numberOfLines={3}
        />
        <TextField
          label="Auto-reply message"
          value={draft.auto_reply ?? ''}
          onChangeText={(v) => setDraft({ auto_reply: v.slice(0, CREATE_AD_AUTO_REPLY_MAX) })}
          multiline
          numberOfLines={3}
        />

        <ExchangeCard style={{ marginBottom: theme.spacing[3], gap: theme.spacing[2] }}>
          <SummaryLine label="Side" value={draft.type ?? '—'} />
          <SummaryLine label="Pair" value={`${draft.currency}/${draft.fiat}`} />
          <SummaryLine label="Pricing" value={draft.pricing_type ?? 'fixed'} />
          <SummaryLine label="Auto-release" value={draft.auto_release ? 'Yes' : 'No'} />
        </ExchangeCard>

        {error || validationErr ? <ErrorBanner message={error ?? validationErr!} /> : null}

        <PrimaryButton
          title={loading ? 'Publishing…' : 'Publish Ad'}
          loading={loading}
          disabled={loading || !!validationErr}
          onPress={() => void publish()}
        />
        <SecondaryButton title="Back to payment settings" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.line}>
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text
        style={[
          theme.typography.bodySm,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sansSemiBold,
            textTransform: 'capitalize',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between' },
});
