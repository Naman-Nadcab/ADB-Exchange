import { useEffect } from 'react';
import { ScrollView, Text, View, StyleSheet, RefreshControl, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SkeletonList,
  EmptyState,
  ErrorState,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { analytics } from '@core/observability/analytics';
import { useP2PDispute } from '../hooks/useP2P';
import { DisputeStatusChip } from '../components/DisputeStatusChip';
import { DisputeSummaryCard } from '../components/DisputeSummaryCard';
import { DisputeEvidenceList } from '../components/DisputeEvidenceList';
import { DisputeAdminNotes } from '../components/DisputeAdminNotes';
import { DisputeResolutionBlock } from '../components/DisputeResolutionBlock';
import { DisputeHistoryList } from '../components/DisputeHistoryList';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'DisputeDetail'>;

export function DisputeDetailScreen({ route, navigation }: Props) {
  const { disputeId, dispute: seedDispute } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useP2PDispute(disputeId, seedDispute);

  useEffect(() => {
    analytics.screen('S-615');
  }, []);

  const d = q.data;

  if (!disputeId) {
    return (
      <ScreenLayout testID="S-615">
        <EmptyState title="Invalid dispute" message="This dispute link is not valid." />
      </ScreenLayout>
    );
  }

  if (q.isLoading && !d) {
    return (
      <ScreenLayout testID="S-615">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (q.isError && !d) {
    return (
      <ScreenLayout testID="S-615">
        <ErrorState title="Could not load dispute" message="Please try again." onRetry={() => void q.refetch()} />
      </ScreenLayout>
    );
  }

  if (!d) {
    return (
      <ScreenLayout testID="S-615">
        <EmptyState title="Dispute not found" message="This dispute may have been removed or you may not have access." />
      </ScreenLayout>
    );
  }

  const openOrder = () => {
    navigation.navigate('OrderRoom', { orderId: d.order_id });
  };

  return (
    <ScreenLayout testID="S-615">
      {!isOnline ? (
        <View style={[styles.offline, { backgroundColor: `hsl(${theme.colors.statusError} / 0.08)` }]}>
          <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 13 }}>Offline — showing cached data.</Text>
        </View>
      ) : null}

      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('OrdersList')} style={styles.backLink}>
          <Ionicons name="arrow-back" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '600' }}>Orders</Text>
        </Pressable>
        <DisputeStatusChip status={d.status} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.titleRow}>
          <Ionicons name="warning-outline" size={20} color="#f59e0b" />
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Dispute</Text>
        </View>

        <DisputeSummaryCard dispute={d} onOrderPress={openOrder} />
        <DisputeEvidenceList evidence={d.evidence} />
        {d.admin_notes ? <DisputeAdminNotes notes={d.admin_notes} /> : null}
        <DisputeResolutionBlock dispute={d} />
        <DisputeHistoryList dispute={d} />

        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 16, lineHeight: 18 }}>
          Further communication happens through support channels. This page reflects the current dispute state.
        </Text>

        <Pressable onPress={openOrder} style={[styles.orderBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Ionicons name="document-text-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.brandPrimary})` }}>View order</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  content: { paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  offline: { borderRadius: 8, padding: 10, marginBottom: 8 },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
});
