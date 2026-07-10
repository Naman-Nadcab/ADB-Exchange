import { useEffect, useState } from 'react';
import { FlatList, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Passkeys'>;

export function PasskeysScreen(_props: Props) {
  const [items, setItems] = useState<{ id: string; name?: string }[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    analytics.screen('S-713');
    void getAuthRepository().getPasskeys().then(setItems);
  }, []);

  return (
    <ScreenLayout testID="S-713">
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 10 }} onPress={() => void getAuthRepository().deletePasskey(item.id).then(() => getAuthRepository().getPasskeys().then(setItems))}>
            <Text>{item.name ?? item.id} — tap to delete</Text>
          </Pressable>
        )}
      />
      <TextField label="Rename" value={name} onChangeText={setName} />
      <PrimaryButton title="Register passkey" onPress={() => {}} />
    </ScreenLayout>
  );
}
