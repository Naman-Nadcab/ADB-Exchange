import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useP2PDispute } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';
import type { P2PDisputeTimelineEntry } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<P2PStackParamList, 'DisputeDetail'>;

export function DisputeDetailScreen({ route }: Props) {
  const { disputeId } = route.params;
  const { theme } = useTheme();
  const q = useP2PDispute(disputeId);

  useEffect(() => {
    analytics.screen('S-615');
  }, []);

  const d = q.data;
  if (!d) {
    return (
      <ScreenLayout testID="S-615">
        <Text>Loading…</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-615">
      <ScrollView>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Dispute {d.status}</Text>
        <Text>Order: {d.order_id}</Text>
        <Text>Reason: {d.reason}</Text>
        <Text>Resolution: {d.resolution ?? 'Pending'}</Text>
        {(d.evidence ?? []).map((url: string, i: number) => (
          <Text key={i} style={{ fontSize: 12 }}>
            Evidence: {url}
          </Text>
        ))}
        {(d.timeline ?? []).map((t: P2PDisputeTimelineEntry, i: number) => (
          <Text key={i} style={{ fontSize: 12 }}>
            {t.status} {t.at ? new Date(t.at).toLocaleString() : ''}
          </Text>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}
