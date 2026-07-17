import { useEffect, useMemo } from 'react';
import { ScrollView, Text, Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useApiKeys } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ApiKeyDetail'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing[2.5], borderBottomWidth: 1, borderBottomColor: `hsl(${theme.colors.borderDefault})` }}>
      <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, marginTop: theme.spacing[1] }]}>
        {value}
      </Text>
    </View>
  );
}

export function ApiKeyDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const q = useApiKeys();
  const item = useMemo(() => q.data?.find((k) => k.id === route.params.id), [q.data, route.params.id]);

  useEffect(() => {
    analytics.screen('S-752');
  }, []);

  if (!item) {
    return (
      <ScreenLayout>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Not found</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-752">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        {q.isLoading ? (
          <SkeletonList rows={4} />
        ) : (
          <ExchangeCard variant="terminal" padded={false}>
            <View style={{ paddingHorizontal: theme.spacing.cardPad }}>
              <DetailRow label="Label" value={item.label} />
              <DetailRow label="Prefix" value={item.key_prefix ?? '—'} />
              <DetailRow label="Permissions" value={(item.permissions ?? []).join(', ') || '—'} />
              <DetailRow label="IP whitelist" value={(item.ip_whitelist ?? []).join(', ') || '—'} />
            </View>
          </ExchangeCard>
        )}
        <PrimaryButton
          title="Revoke key"
          variant="secondary"
          onPress={() =>
            Alert.alert('Revoke API key?', item.label, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Revoke',
                style: 'destructive',
                onPress: () => void getAuthRepository().deleteApiKey(item.id).then(() => navigation.goBack()),
              },
            ])
          }
        />
      </ScrollView>
    </ScreenLayout>
  );
}
