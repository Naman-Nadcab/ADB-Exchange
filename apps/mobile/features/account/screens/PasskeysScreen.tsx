import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Passkeys'>;

export function PasskeysScreen(_props: Props) {
  const { theme } = useTheme();
  const [items, setItems] = useState<{ id: string; name?: string }[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.screen('S-713');
    void getAuthRepository()
      .getPasskeys()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenLayout testID="S-713">
      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: theme.spacing[3], gap: theme.spacing[2] }}
          renderItem={({ item }) => (
            <ExchangeCard variant="terminal">
              <Pressable
                onPress={() =>
                  void getAuthRepository()
                    .deletePasskey(item.id)
                    .then(() => getAuthRepository().getPasskeys().then(setItems))
                }
              >
                <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
                  {item.name ?? item.id}
                </Text>
                <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] }]}>
                  Tap to delete
                </Text>
              </Pressable>
            </ExchangeCard>
          )}
        />
      )}
      <ExchangeCard variant="terminal" style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <TextField label="Rename" value={name} onChangeText={setName} />
        <PrimaryButton title="Register passkey" onPress={() => {}} />
      </ExchangeCard>
    </ScreenLayout>
  );
}
