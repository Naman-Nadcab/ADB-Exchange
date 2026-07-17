import { useEffect, useState } from 'react';
import { ScrollView, Text, Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountDeletion'>;

export function AccountDeletionScreen(_props: Props) {
  const { theme } = useTheme();
  const [pending, setPending] = useState(false);
  const errorPalette = semanticStatusPalette(theme.colors, 'error');

  useEffect(() => {
    analytics.screen('S-792');
    void getAuthRepository().getDeletionStatus().then((s) => setPending(s.pending));
  }, []);

  return (
    <ScreenLayout testID="S-792">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <ExchangeCard style={{ borderColor: errorPalette.border, backgroundColor: errorPalette.bg }}>
          <Text style={[theme.typography.bodyMd, { color: errorPalette.fg, fontFamily: theme.fonts.sansSemiBold }]}>
            Account deletion is irreversible after the cooling-off period.
          </Text>
        </ExchangeCard>

        <ExchangeCard variant="terminal">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Deletion pending</Text>
            <StatusChip label={pending ? 'Yes' : 'No'} tone={pending ? 'warn' : 'neutral'} />
          </View>
        </ExchangeCard>

        <PrimaryButton
          title="Request deletion"
          variant="secondary"
          onPress={() =>
            Alert.alert('Delete account?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Request', style: 'destructive', onPress: () => void getAuthRepository().requestAccountDeletion() },
            ])
          }
        />
        {pending ? (
          <PrimaryButton title="Cancel deletion request" onPress={() => void getAuthRepository().cancelAccountDeletion()} />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}
