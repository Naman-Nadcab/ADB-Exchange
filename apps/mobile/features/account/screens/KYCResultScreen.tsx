import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, StatusChip, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useKycStatus } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCResult'>;

function kycStatusTone(status?: string): StatusChipTone {
  const s = (status ?? '').toLowerCase();
  if (s.includes('approved') || s.includes('verified')) return 'live';
  if (s.includes('reject')) return 'off';
  if (s.includes('pending') || s.includes('review')) return 'sync';
  return 'neutral';
}

export function KYCResultScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useKycStatus();

  useEffect(() => {
    analytics.screen('S-735');
  }, []);

  return (
    <ScreenLayout testID="S-735">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        {q.isLoading ? (
          <SkeletonList rows={3} />
        ) : q.isError ? (
          <ErrorState title="Could not load KYC result" onRetry={() => void q.refetch()} />
        ) : (
          <ExchangeCard elevated>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
              <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>KYC result</Text>
              <StatusChip label={q.data?.status ?? '—'} tone={kycStatusTone(q.data?.status)} />
            </View>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              Verified: {q.data?.verified ? 'Yes' : 'No'}
            </Text>
          </ExchangeCard>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
