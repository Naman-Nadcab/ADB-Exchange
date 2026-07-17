import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField, ErrorBanner, EmptyState, SkeletonList, ExchangeCard } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useP2PStore } from '@core/state/p2pStore';
import { validateCreateAdStep, CREATE_AD_TIME_MIN, CREATE_AD_TIME_MAX } from '@core/domain/p2p/createAd';
import { useMyPaymentMethods, usePlatformPaymentMethods } from '../hooks/useP2P';
import { AdDetailEscrowBanner } from '../components/AdDetailSections';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PostAdPayment'>;

export function PostAdPaymentScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const setDraft = useP2PStore((s) => s.setPostAdDraft);
  const draft = useP2PStore((s) => s.postAdDraft);
  const [selected, setSelected] = useState<string[]>(draft.payment_method_ids ?? []);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const pmQ = useMyPaymentMethods();
  const platformQ = usePlatformPaymentMethods();

  useEffect(() => {
    analytics.screen('S-605');
  }, []);

  const methods = (pmQ.data ?? []).filter((m) => m.is_active !== false);
  const stepErr = validateCreateAdStep('payment', { ...draft, payment_method_ids: selected }, null);

  const toggle = (id: string) => {
    void hapticLight();
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onNext = () => {
    setLocalErr(null);
    const patch = { payment_method_ids: selected, payment_time_limit: draft.payment_time_limit ?? 15, auto_release: draft.auto_release };
    setDraft(patch);
    const err = validateCreateAdStep('payment', { ...draft, ...patch }, null);
    if (err) {
      setLocalErr(err);
      return;
    }
    navigation.navigate('PostAdReview');
  };

  return (
    <ScreenLayout testID="S-605">
      {!isOnline ? <ErrorBanner message="Offline — payment methods may be stale." onRetry={() => void pmQ.refetch()} /> : null}
      <AdDetailEscrowBanner />

      <TextField
        label={`Payment window (${CREATE_AD_TIME_MIN}–${CREATE_AD_TIME_MAX} min)`}
        value={String(draft.payment_time_limit ?? 15)}
        onChangeText={(v) => setDraft({ payment_time_limit: parseInt(v, 10) || 15 })}
        keyboardType="number-pad"
      />

      <ExchangeCard
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          marginBottom: theme.spacing[3],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Auto-release
          </Text>
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
            ]}
          >
            Release crypto when buyer marks paid.
          </Text>
        </View>
        <Switch value={draft.auto_release === true} onValueChange={(v) => setDraft({ auto_release: v })} />
      </ExchangeCard>

      <Text
        style={[
          theme.typography.bodyMd,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sansBold,
            marginBottom: theme.spacing[2],
            marginTop: theme.spacing[2],
          },
        ]}
      >
        Accepted methods {selected.length > 0 ? `(${selected.length})` : ''}
      </Text>

      {pmQ.isLoading ? (
        <SkeletonList rows={4} />
      ) : methods.length === 0 ? (
        <EmptyState
          title="No payment methods"
          message="Add a payment method before posting an ad."
          actionLabel="Add method"
          onAction={() => navigation.navigate('PaymentMethods')}
        />
      ) : (
        <FlatList
          data={methods}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 280 }}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <Pressable onPress={() => toggle(item.id)}>
                <ExchangeCard
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing[2.5],
                    marginBottom: theme.spacing[2],
                    borderColor: checked ? `hsl(${theme.colors.brandPrimary})` : undefined,
                    backgroundColor: checked ? `hsl(${theme.colors.brandPrimary} / 0.06)` : undefined,
                  }}
                >
                  <Text
                    style={[
                      theme.typography.headingSm,
                      {
                        color: checked ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                      },
                    ]}
                  >
                    {checked ? '☑' : '☐'}
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodySm,
                      { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                    ]}
                  >
                    {item.display_name ?? item.method_name}
                  </Text>
                </ExchangeCard>
              </Pressable>
            );
          }}
        />
      )}

      {platformQ.data && platformQ.data.length > 0 ? (
        <Text
          style={[
            theme.typography.labelSm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2] },
          ]}
        >
          Platform types: {platformQ.data.map((p) => p.code).filter(Boolean).join(', ')}
        </Text>
      ) : null}

      {localErr || stepErr ? <ErrorBanner message={localErr ?? stepErr!} /> : null}

      <PrimaryButton
        title="Preview & Publish"
        disabled={!!stepErr || methods.length === 0}
        onPress={onNext}
        style={{ marginTop: theme.spacing[2] }}
      />
    </ScreenLayout>
  );
}
