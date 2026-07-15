import { useEffect } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ScreenLayout, ExchangeCard, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
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
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Withdrawal limits</Text>
        <Text style={[styles.sub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
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
            <Text style={[styles.note, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              Max configurable: {q.data?.maxDailyLimit ?? '—'} daily · {q.data?.maxMonthlyLimit ?? '—'} monthly
            </Text>
          </ExchangeCard>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 13, marginBottom: 16 },
  row: { paddingVertical: 10 },
  rowLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, marginTop: 8 },
});
