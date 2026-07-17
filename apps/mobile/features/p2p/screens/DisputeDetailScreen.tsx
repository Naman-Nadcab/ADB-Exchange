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
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const warning = semanticStatusPalette(theme.colors, 'warning');
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
        <View
          style={[
            styles.offline,
            {
              backgroundColor: `hsl(${theme.colors.statusError} / 0.08)`,
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              marginBottom: theme.spacing[2],
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.statusError})` }]}>
            Offline — showing cached data.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.topBar,
          {
            marginBottom: theme.spacing[3],
            paddingBottom: theme.spacing[3],
            borderBottomColor: `hsl(${theme.colors.borderDefault})`,
          },
        ]}
      >
        <Pressable onPress={() => navigation.navigate('OrdersList')} style={[styles.backLink, { gap: theme.spacing[1.5] }]}>
          <Ionicons name="arrow-back" size={theme.sizes.iconSm} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Orders
          </Text>
        </Pressable>
        <DisputeStatusChip status={d.status} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        contentContainerStyle={{ paddingBottom: theme.spacing[8] }}
      >
        <View style={[styles.titleRow, { gap: theme.spacing[2], marginBottom: theme.spacing[4] }]}>
          <Ionicons name="warning-outline" size={theme.sizes.iconMd} color={warning.fg} />
          <Text
            style={[
              theme.typography.headingMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            Dispute
          </Text>
        </View>

        <DisputeSummaryCard dispute={d} onOrderPress={openOrder} />
        <DisputeEvidenceList evidence={d.evidence} />
        {d.admin_notes ? <DisputeAdminNotes notes={d.admin_notes} /> : null}
        <DisputeResolutionBlock dispute={d} />
        <DisputeHistoryList dispute={d} />

        <Text
          style={[
            theme.typography.bodySm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              marginTop: theme.spacing[4],
            },
          ]}
        >
          Further communication happens through support channels. This page reflects the current dispute state.
        </Text>

        <Pressable
          onPress={openOrder}
          style={[
            styles.orderBtn,
            {
              borderColor: `hsl(${theme.colors.borderDefault})`,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing[5],
              paddingVertical: theme.spacing[3],
              gap: theme.spacing[2],
            },
          ]}
        >
          <Ionicons name="document-text-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            View order
          </Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backLink: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  offline: {},
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
