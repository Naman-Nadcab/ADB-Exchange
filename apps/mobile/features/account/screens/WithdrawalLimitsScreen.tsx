import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useQuery } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'WithdrawalLimits'>;

type WithdrawalLimits = {
  dailyLimit?: string;
  monthlyLimit?: string;
  dailyUsed?: string;
  monthlyUsed?: string;
  maxDailyLimit?: string;
  maxMonthlyLimit?: string;
};

function LimitRow({ label, used, limit }: { label: string; used?: string; limit?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing[2.5] }}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansSemiBold,
            marginBottom: theme.spacing[1],
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          theme.typography.bodyLg,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, fontVariant: ['tabular-nums'] },
        ]}
      >
        {used ?? '0'} / {limit ?? '—'} USDT
      </Text>
    </View>
  );
}

export function WithdrawalLimitsScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useQuery({
    queryKey: ['withdrawal-limits'],
    queryFn: () => getAuthRepository().getWithdrawalLimits() as Promise<WithdrawalLimits>,
  });

  useEffect(() => {
    analytics.screen('S-717');
  }, []);

  return (
    <ScreenLayout testID="S-717">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        <Text
          style={[
            theme.typography.headingLg,
            { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[1] },
          ]}
        >
          Withdrawal limits
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[4] },
          ]}
        >
          Daily and monthly withdrawal caps for your account tier.
        </Text>

        {q.isLoading ? (
          <SkeletonList rows={4} />
        ) : q.isError ? (
          <ErrorState title="Could not load limits" onRetry={() => void q.refetch()} />
        ) : (
          <ExchangeCard elevated>
            <LimitRow label="Daily" used={q.data?.dailyUsed} limit={q.data?.dailyLimit} />
            <LimitRow label="Monthly" used={q.data?.monthlyUsed} limit={q.data?.monthlyLimit} />
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[2] },
              ]}
            >
              Max configurable: {q.data?.maxDailyLimit ?? '—'} daily · {q.data?.maxMonthlyLimit ?? '—'} monthly
            </Text>
          </ExchangeCard>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
