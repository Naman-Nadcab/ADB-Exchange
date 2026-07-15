import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, SkeletonList } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { CREATE_AD_AUTO_REPLY_MAX, CREATE_AD_REMARKS_MAX } from '@core/domain/p2p/createAd';
import { useMyP2PAds, useUpdateAd } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'EditAd'>;

export function EditAdScreen({ navigation, route }: Props) {
  const { adId, ad: seedAd } = route.params;
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useMyP2PAds();
  const update = useUpdateAd();
  const lockRef = useRef(false);

  const ad = useMemo(() => {
    if (seedAd?.id === adId) return seedAd;
    return q.data?.find((a) => a.id === adId);
  }, [q.data, adId, seedAd]);

  const [price, setPrice] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [available, setAvailable] = useState('');
  const [remarks, setRemarks] = useState('');
  const [autoReply, setAutoReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-608');
  }, []);

  useEffect(() => {
    if (!ad) return;
    setPrice(ad.current_price ?? ad.price ?? '');
    setMinAmount(ad.min_amount ?? '');
    setMaxAmount(ad.max_amount ?? '');
    setAvailable(ad.available_amount ?? '');
    setRemarks(ad.remarks ?? ad.terms_and_conditions ?? '');
    setAutoReply(ad.auto_reply ?? '');
  }, [ad]);

  const save = async () => {
    if (!ad || lockRef.current || update.isPending) return;
    if (!isOnline) {
      setError('Offline — cannot save changes');
      return;
    }
    setError(null);
    lockRef.current = true;
    try {
      await update.mutateAsync({
        id: ad.id,
        price: price.trim(),
        min_amount: minAmount.trim(),
        max_amount: maxAmount.trim(),
        available_amount: available.trim(),
        remarks: remarks.trim() || undefined,
        auto_reply: autoReply.trim() || undefined,
      });
      navigation.replace('AdDetail', { adId: ad.id, ad: { ...ad, current_price: price, min_amount: minAmount, max_amount: maxAmount, available_amount: available } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save ad');
    } finally {
      lockRef.current = false;
    }
  };

  if (q.isLoading && !ad) {
    return (
      <ScreenLayout testID="S-608">
        <SkeletonList rows={8} />
      </ScreenLayout>
    );
  }

  if (!ad) {
    return (
      <ScreenLayout testID="S-608">
        <ErrorBanner message="Ad not found in your listings." />
        <PrimaryButton title="Back" onPress={() => navigation.goBack()} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-608">
      <ScrollView>
        {!isOnline ? <ErrorBanner message="Offline — changes cannot be saved." /> : null}
        <TextField label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <TextField label="Min amount" value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" />
        <TextField label="Max amount" value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" />
        <TextField label="Available" value={available} onChangeText={setAvailable} keyboardType="decimal-pad" />
        <TextField
          label="Terms / Remarks"
          value={remarks}
          onChangeText={(v) => setRemarks(v.slice(0, CREATE_AD_REMARKS_MAX))}
          multiline
        />
        <TextField
          label="Auto reply"
          value={autoReply}
          onChangeText={(v) => setAutoReply(v.slice(0, CREATE_AD_AUTO_REPLY_MAX))}
          multiline
        />
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Save changes" loading={update.isPending} onPress={() => void save()} />
        <PrimaryButton
          title={ad.status === 'paused' ? 'Resume ad' : 'Pause ad'}
          variant="secondary"
          onPress={() => {
            if (lockRef.current) return;
            const next = ad.status === 'paused' ? 'active' : 'paused';
            Alert.alert(next === 'paused' ? 'Pause ad?' : 'Resume ad?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Confirm',
                onPress: () => void update.mutateAsync({ id: ad.id, status: next }),
              },
            ]);
          }}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}
