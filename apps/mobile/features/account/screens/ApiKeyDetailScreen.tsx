import { useEffect, useMemo } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useApiKeys } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';
import type { ApiKey } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ApiKeyDetail'>;

export function ApiKeyDetailScreen({ navigation, route }: Props) {
  const q = useApiKeys();
  const item = useMemo(() => q.data?.find((k: ApiKey) => k.id === route.params.id), [q.data, route.params.id]);

  useEffect(() => {
    analytics.screen('S-752');
  }, []);

  if (!item) return <ScreenLayout><Text>Not found</Text></ScreenLayout>;

  return (
    <ScreenLayout testID="S-752">
      <ScrollView>
        <Text>Label: {item.label}</Text>
        <Text>Prefix: {item.key_prefix ?? '—'}</Text>
        <Text>Permissions: {(item.permissions ?? []).join(', ') || '—'}</Text>
        <Text>IP whitelist: {(item.ip_whitelist ?? []).join(', ') || '—'}</Text>
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
