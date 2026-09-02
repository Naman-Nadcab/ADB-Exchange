import { useEffect } from 'react';
import { Share, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useReferralAnalytics } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralShare'>;

export function ReferralShareScreen(_props: Props) {
  const { theme } = useTheme();
  const q = useReferralAnalytics();

  useEffect(() => {
    analytics.screen('S-744');
  }, []);

  const code = q.data?.referral_code ?? '';
  const link = `https://app.metheorium.com/referral/${code}`;

  return (
    <ScreenLayout testID="S-744">
      <ExchangeCard elevated style={{ marginBottom: theme.spacing[4] }}>
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
          Referral code
        </Text>
        <Text
          style={[
            theme.typography.headingMd,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[3] },
          ]}
        >
          {code || '—'}
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.mono },
          ]}
          selectable
        >
          {link}
        </Text>
      </ExchangeCard>
      <View style={{ gap: theme.spacing[3] }}>
        <PrimaryButton title="Share" onPress={() => void Share.share({ message: `Join FDM: ${link}` })} />
      </View>
    </ScreenLayout>
  );
}
