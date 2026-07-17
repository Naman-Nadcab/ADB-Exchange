import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useFeeTier } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'FeeTier'>;

function StatRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing[2.5], borderBottomWidth: 1, borderBottomColor: `hsl(${theme.colors.borderDefault})` }}>
      <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[theme.typography.bodyLg, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginTop: theme.spacing[1], fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
    </View>
  );
}

export function FeeTierScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useFeeTier();

  useEffect(() => {
    analytics.screen('S-741');
  }, []);

  const t = q.data;

  return (
    <ScreenLayout testID="S-741">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[4] }]}>
          Fee tier & VIP
        </Text>

        {q.isLoading ? (
          <SkeletonList rows={4} />
        ) : q.isError ? (
          <ErrorState title="Could not load fee tier" onRetry={() => void q.refetch()} />
        ) : (
          <ExchangeCard variant="terminal" padded={false}>
            <View style={{ paddingHorizontal: theme.spacing.cardPad }}>
              <StatRow label="Tier" value={String(t?.tier_name ?? t?.tier_level ?? '—')} />
              <StatRow label="Maker" value={String(t?.maker_fee ?? '—')} />
              <StatRow label="Taker" value={String(t?.taker_fee ?? '—')} />
              <StatRow label="VIP" value={t?.vip ? 'Yes' : 'No'} />
            </View>
          </ExchangeCard>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
