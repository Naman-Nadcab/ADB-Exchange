import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, ErrorState, SkeletonList } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { analytics } from '@core/observability/analytics';
import { ApiError } from '@core/api/errors/ApiError';
import {
  buildPaymentDetailsPayload,
  fieldsFromExistingDetails,
  getFieldsForMethodCode,
  methodIconName,
  validatePaymentMethodForm,
} from '@core/domain/p2p/paymentMethods';
import { usePlatformPaymentMethods, usePaymentMethod } from '../hooks/useP2P';
import { usePaymentMethodActions } from '../hooks/usePaymentMethodActions';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'AddPaymentMethod'>;

export function AddPaymentMethodScreen({ navigation, route }: Props) {
  const editId = route.params.id;
  const seed = route.params.method;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const platformQ = usePlatformPaymentMethods();
  const existingQ = usePaymentMethod(editId ?? '', seed);
  const actions = usePaymentMethodActions();

  const existing = existingQ.method;
  const isEdit = !!editId;

  const [platformId, setPlatformId] = useState(existing?.payment_method_id ?? '');
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlatform = useMemo(
    () => platformQ.data?.find((p) => p.id === platformId) ?? platformQ.data?.find((p) => p.id === existing?.payment_method_id),
    [platformQ.data, platformId, existing?.payment_method_id],
  );

  const formFields = useMemo(
    () => getFieldsForMethodCode(isEdit ? existing?.method_code : selectedPlatform?.code),
    [isEdit, existing?.method_code, selectedPlatform?.code],
  );

  useEffect(() => {
    analytics.screen('S-612');
  }, []);

  useEffect(() => {
    if (!existing) return;
    setPlatformId(existing.payment_method_id ?? '');
    setDisplayName(existing.display_name ?? '');
    setFields(fieldsFromExistingDetails(formFields, existing.payment_details));
  }, [existing, formFields]);

  if (isEdit && existingQ.isLoading && !existing) {
    return (
      <ScreenLayout testID="S-612">
        <SkeletonList rows={5} />
      </ScreenLayout>
    );
  }

  if (isEdit && !existingQ.isLoading && !existing) {
    return (
      <ScreenLayout testID="S-612">
        <ErrorState title="Payment method not found" onRetry={() => void existingQ.refetch()} />
      </ScreenLayout>
    );
  }

  const submit = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot save payment method');
      return;
    }
    const validation = validatePaymentMethodForm(platformId, fields, formFields);
    if (validation) {
      setError(validation);
      return;
    }
    const payment_details = buildPaymentDetailsPayload(fields, formFields);
    setSubmitting(true);
    try {
      if (isEdit && editId) {
        await actions.update(editId, {
          display_name: displayName.trim() || undefined,
          payment_details,
        });
      } else {
        await actions.add({
          payment_method_id: platformId,
          display_name: displayName.trim() || undefined,
          payment_details,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save payment method');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout testID="S-612">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {isEdit ? 'Edit payment method' : 'Add payment method'}
        </Text>

        {!isEdit ? (
          <>
            <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Payment type</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginBottom: 10 }}>
              Choose how buyers will send you fiat.
            </Text>
            <View style={styles.typeGrid}>
              {(platformQ.data ?? []).map((p) => {
                const selected = platformId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      hapticLight();
                      setPlatformId(p.id);
                      setFields({});
                    }}
                    style={[
                      styles.typeCard,
                      {
                        borderColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.5)` : `hsl(${theme.colors.borderDefault})`,
                        backgroundColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.08)` : `hsl(${theme.colors.backgroundElevated})`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={methodIconName(p.code)}
                      size={20}
                      color={selected ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
                    />
                    <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 6 }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={[styles.editBanner, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
            <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{existing?.method_name}</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 2 }}>{existing?.method_code}</Text>
          </View>
        )}

        {(platformId || isEdit) && (
          <>
            <TextField
              label="Display name (optional)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={`e.g. My ${selectedPlatform?.name ?? existing?.method_name ?? 'payment'} account`}
            />
            {formFields.map((f) => (
              <TextField
                key={f.key}
                label={`${f.label}${f.required ? ' *' : ''}`}
                value={fields[f.key] ?? ''}
                onChangeText={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={f.placeholder}
              />
            ))}

            {error ? <ErrorBanner message={error} /> : null}

            <View style={styles.footer}>
              <PrimaryButton
                title={submitting ? 'Saving…' : 'Save method'}
                loading={submitting || actions.isLocked()}
                onPress={() => void submit()}
              />
              <PrimaryButton title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
            </View>

            <View style={styles.security}>
              <Ionicons name="shield-checkmark-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>Encrypted in transit</Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  typeCard: { width: '47%', borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  editBanner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  footer: { gap: 10, marginTop: 8 },
  security: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
});
