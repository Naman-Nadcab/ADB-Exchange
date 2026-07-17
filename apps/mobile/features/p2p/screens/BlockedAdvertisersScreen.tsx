import { useEffect } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useP2PStore } from '@core/state/p2pStore';
import { useUnblockAdvertiser } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'BlockedAdvertisers'>;

export function BlockedAdvertisersScreen(_props: Props) {
  const { theme } = useTheme();
  const blocked = useP2PStore((s) => s.blockedAdvertiserIds);
  const unblock = useUnblockAdvertiser();

  useEffect(() => {
    analytics.screen('S-616');
  }, []);

  return (
    <ScreenLayout testID="S-616">
      <FlatList
        data={blocked}
        keyExtractor={(id) => id}
        renderItem={({ item }) => (
          <Pressable
            style={{ paddingVertical: theme.spacing[3], minHeight: theme.listDensity.default.rowHeight }}
            onPress={() => unblock.mutate(item)}
          >
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{item}</Text>
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Tap to unblock</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text
            style={[
              theme.typography.bodyMd,
              { textAlign: 'center', marginTop: theme.spacing[6], color: `hsl(${theme.colors.foregroundSecondary})` },
            ]}
          >
            No blocked advertisers
          </Text>
        }
      />
    </ScreenLayout>
  );
}
