import { useEffect } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { FAQ } from '../data/faq';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'HelpFaq'>;

export function HelpFaqScreen(_props: Props) {
  const { theme } = useTheme();

  useEffect(() => {
    analytics.screen('S-760');
  }, []);

  return (
    <ScreenLayout testID="S-760">
      <FlatList
        data={FAQ}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[2] }}
        renderItem={({ item }) => (
          <ExchangeCard variant="terminal">
            <Pressable>
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
                ]}
              >
                {item.q}
              </Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                ]}
              >
                {item.a}
              </Text>
            </Pressable>
          </ExchangeCard>
        )}
      />
    </ScreenLayout>
  );
}
