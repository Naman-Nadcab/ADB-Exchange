import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useReferralAnalytics } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralHome'>;

function StatRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[theme.typography.bodyLg, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginTop: theme.spacing[1], fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
    </View>
  );
}

export function ReferralHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useReferralAnalytics();

  useEffect(() => {
    analytics.screen('S-742');
  }, []);

  const r = q.data;

  return (
    <ScreenLayout testID="S-742">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        {q.isLoading ? (
          <SkeletonList rows={4} />
        ) : q.isError ? (
          <ErrorState title="Could not load referral stats" onRetry={() => void q.refetch()} />
        ) : (
          <ExchangeCard elevated>
            <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
              <StatRow label="Code" value={r?.referral_code ?? '—'} />
              <StatRow label="Referrals" value={String(r?.total_referrals ?? 0)} />
            </View>
            <View style={{ marginTop: theme.spacing[4] }}>
              <StatRow label="Commission" value={String(r?.total_commission ?? '0')} />
            </View>
          </ExchangeCard>
        )}
        <ExchangeCard variant="terminal" padded={false}>
          <View style={{ paddingHorizontal: theme.spacing[2] }}>
            <AccountMenuRow label="My referrals" onPress={() => navigation.navigate('ReferralList')} />
          </View>
        </ExchangeCard>
        <PrimaryButton title="Share referral" onPress={() => navigation.navigate('ReferralShare')} />
      </ScrollView>
    </ScreenLayout>
  );
}
