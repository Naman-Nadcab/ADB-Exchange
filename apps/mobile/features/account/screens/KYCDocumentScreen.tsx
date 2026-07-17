import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getKycRepository } from '@core/repositories/UserRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCDocument'>;

export function KYCDocumentScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [country, setCountry] = useState('IN');
  const [docType, setDocType] = useState('aadhaar');

  useEffect(() => {
    analytics.screen('S-733');
  }, []);

  const start = async () => {
    await getKycRepository().initiate({ country, documentType: docType });
    navigation.navigate('KYCResult');
  };

  return (
    <ScreenLayout testID="S-733">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Submit your identity documents for verification.
        </Text>
        <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
          <TextField label="Country" value={country} onChangeText={setCountry} />
          <TextField label="Document type" value={docType} onChangeText={setDocType} />
          <PrimaryButton title="Initiate & upload" onPress={() => void start()} />
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
