import { useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useApiKeys } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ApiKeys'>;

export function ApiKeysScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useApiKeys();

  useEffect(() => {
    analytics.screen('S-750');
  }, []);

  return (
    <ScreenLayout testID="S-750">
      <View style={{ marginBottom: theme.spacing[3] }}>
        <PrimaryButton title="Create API Key" onPress={() => navigation.navigate('CreateApiKey')} />
      </View>

      {q.isLoading && !q.data ? (
        <SkeletonList rows={4} />
      ) : q.isError && !q.data ? (
        <ErrorState title="Could not load API keys" onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(k) => k.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          ListEmptyComponent={
            <EmptyState
              icon="key-outline"
              title="No API keys"
              message="Create an API key to connect trading bots or third-party tools."
            />
          }
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[2] }}>
              <Pressable onPress={() => navigation.navigate('ApiKeyDetail', { id: item.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, flex: 1 },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <StatusChip label="Active" tone="live" />
                </View>
                <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1], fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
                ]}
                >
                  {item.key_prefix ?? item.id}
                </Text>
              </Pressable>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
