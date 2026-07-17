import { useEffect } from 'react';
import { FlatList, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useLoginActivity } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'LoginHistory'>;

export function LoginHistoryScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useLoginActivity();

  useEffect(() => {
    analytics.screen('S-704');
  }, []);

  return (
    <ScreenLayout testID="S-704">
      {q.isLoading && !q.data ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal">
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                ]}
              >
                {item.action}
              </Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1], fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
                ]}
              >
                {item.ip ?? ''} · {new Date(item.created_at).toLocaleString()}
              </Text>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
