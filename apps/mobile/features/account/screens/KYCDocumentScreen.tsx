import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getKycRepository } from '@core/repositories/UserRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCDocument'>;

export function KYCDocumentScreen({ navigation }: Props) {
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
      <ScrollView>
        <TextField label="Country" value={country} onChangeText={setCountry} />
        <TextField label="Document type" value={docType} onChangeText={setDocType} />
        <PrimaryButton title="Initiate & upload" onPress={() => void start()} />
      </ScrollView>
    </ScreenLayout>
  );
}
