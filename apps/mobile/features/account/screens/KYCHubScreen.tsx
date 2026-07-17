import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useKycStatus } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCHub'>;

function kycStatusTone(status?: string): StatusChipTone {
  const s = (status ?? '').toLowerCase();
  if (s.includes('approved') || s.includes('verified')) return 'live';
  if (s.includes('reject')) return 'off';
  if (s.includes('pending') || s.includes('review')) return 'sync';
  return 'neutral';
}

export function KYCHubScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useKycStatus();

  useEffect(() => {
    analytics.screen('S-730');
  }, []);

  const k = q.data;

  return (
    <ScreenLayout testID="S-730">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        {q.isLoading && !k ? (
          <SkeletonList rows={4} />
        ) : q.isError && !k ? (
          <ErrorState title="Could not load KYC status" onRetry={() => void q.refetch()} />
        ) : (
          <>
            <ExchangeCard elevated>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
                <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                  Identity verification
                </Text>
                <StatusChip label={k?.status ?? '—'} tone={kycStatusTone(k?.status)} />
              </View>
            </ExchangeCard>

            <ExchangeCard variant="terminal">
              <View style={{ gap: theme.spacing[3] }}>
                <View>
                  <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
                    Level
                  </Text>
                  <Text style={[theme.typography.bodyLg, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, marginTop: theme.spacing[1] }]}>
                    {k?.kycLevel ?? k?.kyc_level ?? 0}
                  </Text>
                </View>
                <View>
                  <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
                    Verified
                  </Text>
                  <Text style={[theme.typography.bodyLg, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold, marginTop: theme.spacing[1] }]}>
                    {k?.verified ? 'Yes' : 'No'}
                  </Text>
                </View>
                {k?.rejectionReason || k?.rejection_reason ? (
                  <View>
                    <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold, textTransform: 'uppercase' }]}>
                      Reason
                    </Text>
                    <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: theme.spacing[1] }]}>
                      {k.rejectionReason ?? k.rejection_reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ExchangeCard>

            {k?.status === 'rejected' || k?.status === 'not_submitted' ? (
              <PrimaryButton title="Start / Retry KYC" onPress={() => navigation.navigate('KYCDocument')} />
            ) : null}
            {k?.status === 'approved' || k?.verified ? (
              <PrimaryButton title="View result" variant="secondary" onPress={() => navigation.navigate('KYCResult')} />
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
