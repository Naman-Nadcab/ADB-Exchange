import { useEffect } from 'react';
import { FlatList, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { FAQ } from '../data/faq';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'HelpFaq'>;

export function HelpFaqScreen(_props: Props) {
  useEffect(() => {
    analytics.screen('S-760');
  }, []);

  return (
    <ScreenLayout testID="S-760">
      <FlatList
        data={FAQ}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 12 }}>
            <Text style={{ fontWeight: '600' }}>{item.q}</Text>
            <Text style={{ fontSize: 13, marginTop: 4 }}>{item.a}</Text>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
