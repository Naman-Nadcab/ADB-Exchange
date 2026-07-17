import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, ErrorState, SkeletonList, ExchangeCard } from '@shared/ui';
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
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[8] }}>
        <Text
          style={[
            theme.typography.headingMd,
            {
              color: `hsl(${theme.colors.foregroundPrimary})`,
              fontFamily: theme.fonts.sansBold,
              marginBottom: theme.spacing[3],
            },
          ]}
        >
          {isEdit ? 'Edit payment method' : 'Add payment method'}
        </Text>

        {!isEdit ? (
          <>
            <Text
              style={[
                theme.typography.labelSm,
                {
                  color: `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: theme.fonts.sansBold,
                  textTransform: 'uppercase',
                  marginBottom: theme.spacing[1],
                },
              ]}
            >
              Payment type
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2.5] },
              ]}
            >
              Choose how buyers will send you fiat.
            </Text>
            <View style={[styles.typeGrid, { gap: theme.spacing[2.5], marginBottom: theme.spacing[4] }]}>
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
                  >
                    <ExchangeCard
                      style={{
                        width: '47%',
                        alignItems: 'center',
                        borderColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.5)` : undefined,
                        backgroundColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.08)` : undefined,
                      }}
                    >
                      <Ionicons
                        name={methodIconName(p.code)}
                        size={theme.sizes.iconMd}
                        color={selected ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
                      />
                      <Text
                        style={[
                          theme.typography.bodySm,
                          {
                            color: `hsl(${theme.colors.foregroundPrimary})`,
                            fontFamily: theme.fonts.sansBold,
                            marginTop: theme.spacing[1.5],
                          },
                        ]}
                      >
                        {p.name}
                      </Text>
                    </ExchangeCard>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <ExchangeCard style={{ marginBottom: theme.spacing[3] }}>
            <Text
              style={[
                theme.typography.bodyMd,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
              ]}
            >
              {existing?.method_name}
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              {existing?.method_code}
            </Text>
          </ExchangeCard>
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

            <View style={{ gap: theme.spacing[2.5], marginTop: theme.spacing[2] }}>
              <PrimaryButton
                title={submitting ? 'Saving…' : 'Save method'}
                loading={submitting || actions.isLocked()}
                onPress={() => void submit()}
              />
              <PrimaryButton title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
            </View>

            <View style={[styles.security, { gap: theme.spacing[2], marginTop: theme.spacing[3] }]}>
              <Ionicons name="shield-checkmark-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                Encrypted in transit
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  security: { flexDirection: 'row', alignItems: 'center' },
});
