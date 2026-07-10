import { useEffect, useState } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountDeletion'>;

export function AccountDeletionScreen(_props: Props) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    analytics.screen('S-792');
    void getAuthRepository().getDeletionStatus().then((s) => setPending(s.pending));
  }, []);

  return (
    <ScreenLayout testID="S-792">
      <ScrollView>
        <Text>Account deletion is irreversible after the cooling-off period.</Text>
        <Text style={{ marginVertical: 12 }}>Pending: {pending ? 'Yes' : 'No'}</Text>
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
