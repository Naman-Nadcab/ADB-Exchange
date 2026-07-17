import { useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useSessions } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Sessions'>;

export function SessionsScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useSessions();

  useEffect(() => {
    analytics.screen('S-716');
  }, []);

  return (
    <ScreenLayout testID="S-716">
      <View style={{ marginBottom: theme.spacing[3] }}>
        <PrimaryButton title="Logout other devices" onPress={() => void getAuthRepository().logoutAllOther()} />
      </View>

      {q.isLoading && !q.data ? (
        <SkeletonList rows={4} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                    ]}
                  >
                    {item.device ?? 'Device'}
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodySm,
                      { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                    ]}
                  >
                    {item.last_active_at ? new Date(item.last_active_at).toLocaleString() : ''}
                  </Text>
                </View>
                {item.current ? <StatusChip label="Current" tone="live" /> : null}
              </View>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
