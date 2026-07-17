import { useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, StatusChip, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useReferrals } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralList'>;

function referralStatusTone(status: string): StatusChipTone {
  const s = status.toLowerCase();
  if (s.includes('active') || s.includes('complete')) return 'live';
  if (s.includes('pending')) return 'sync';
  return 'neutral';
}

export function ReferralListScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useReferrals();

  useEffect(() => {
    analytics.screen('S-743');
  }, []);

  return (
    <ScreenLayout testID="S-743">
      {q.isLoading && !q.data ? (
        <SkeletonList rows={5} />
      ) : q.isError && !q.data ? (
        <ErrorState title="Could not load referrals" onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No referrals yet" message="Share your referral code to invite friends." />}
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
                    {item.referred_user ?? item.id}
                  </Text>
                  <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1], fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }]}>
                    Commission: {item.commission ?? '—'}
                  </Text>
                </View>
                <StatusChip label={item.status ?? 'unknown'} tone={referralStatusTone(item.status ?? 'unknown')} />
              </View>
            </ExchangeCard>
          )}
        />
      )}
    </ScreenLayout>
  );
}
