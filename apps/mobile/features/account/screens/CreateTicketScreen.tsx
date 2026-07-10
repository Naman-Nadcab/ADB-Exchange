import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getSupportRepository } from '@core/repositories/UserRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'CreateTicket'>;

export function CreateTicketScreen({ navigation }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    analytics.screen('S-763');
  }, []);

  const submit = async () => {
    const t = await getSupportRepository().createTicket({ subject, message });
    navigation.replace('TicketDetail', { id: t.id });
  };

  return (
    <ScreenLayout testID="S-763">
      <ScrollView>
        <TextField label="Subject" value={subject} onChangeText={setSubject} />
        <TextField label="Message" value={message} onChangeText={setMessage} />
        <PrimaryButton title="Submit" onPress={() => void submit()} />
      </ScrollView>
    </ScreenLayout>
  );
}
