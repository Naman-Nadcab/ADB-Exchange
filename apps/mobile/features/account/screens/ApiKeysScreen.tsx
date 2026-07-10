import { useEffect } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useApiKeys } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ApiKeys'>;

export function ApiKeysScreen({ navigation }: Props) {
  const q = useApiKeys();

  useEffect(() => {
    analytics.screen('S-750');
  }, []);

  return (
    <ScreenLayout testID="S-750">
      <PrimaryButton title="Create API Key" onPress={() => navigation.navigate('CreateApiKey')} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(k) => k.id}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 12 }} onPress={() => navigation.navigate('ApiKeyDetail', { id: item.id })}>
            <Text style={{ fontWeight: '600' }}>{item.label}</Text>
            <Text style={{ fontSize: 12 }}>{item.key_prefix ?? item.id}</Text>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
