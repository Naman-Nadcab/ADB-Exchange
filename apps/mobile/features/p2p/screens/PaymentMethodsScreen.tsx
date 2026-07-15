import { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, Text, View, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  PrimaryButton,
  SecondaryButton,
  SkeletonList,
  EmptyState,
  ErrorState,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useAppStore } from '@core/state/appStore';
import { analytics } from '@core/observability/analytics';
import { countPaymentMethodsByActive, isPaymentMethodActive } from '@core/domain/p2p/paymentMethods';
import { useMyPaymentMethods } from '../hooks/useP2P';
import { usePaymentMethodActions } from '../hooks/usePaymentMethodActions';
import { PaymentMethodCard } from '../components/PaymentMethodCard';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PaymentMethods'>;

export function PaymentMethodsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useMyPaymentMethods();
  const actions = usePaymentMethodActions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-611');
  }, []);

  const counts = useMemo(() => countPaymentMethodsByActive(q.data ?? []), [q.data]);
  const list = q.data ?? [];

  const runAction = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setActionId(id);
    try {
      await fn();
    } finally {
      setActionId(null);
    }
  }, []);

  if (q.isLoading && !list.length) {
    return (
      <ScreenLayout testID="S-611">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (q.isError && !list.length) {
    return (
      <ScreenLayout testID="S-611">
        <ErrorState title="Could not load payment methods" onRetry={() => void q.refetch()} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-611">
      {!isOnline ? (
        <View style={[styles.offline, { backgroundColor: `hsl(${theme.colors.statusError} / 0.08)` }]}>
          <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 13 }}>Offline — showing cached data.</Text>
        </View>
      ) : null}

      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})` }}>P2P · PAYMENTS</Text>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Payment methods</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            Add how you receive fiat for P2P trades. Details stay private until you match with a counterparty.
          </Text>
        </View>

        <PrimaryButton title="Add method" onPress={() => navigation.navigate('AddPaymentMethod', {})} />

        {list.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={[styles.chip, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
              <Text style={{ fontWeight: '800', color: `hsl(${theme.colors.brandPrimary})` }}>{counts.active}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}> active</Text>
            </View>
            {counts.disabled > 0 ? (
              <View style={[styles.chip, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
                <Text style={{ fontWeight: '800', color: `hsl(${theme.colors.foregroundPrimary})` }}>{counts.disabled}</Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}> disabled</Text>
              </View>
            ) : null}
            <View style={[styles.chip, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
              <Ionicons name="lock-closed-outline" size={12} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}> Shown only during trades</Text>
            </View>
          </View>
        ) : null}

        {list.length === 0 ? (
          <EmptyState
            title="No payment methods yet"
            message="Add at least one way to receive fiat so you can publish ads and take trades."
            actionLabel="Add method"
            onAction={() => navigation.navigate('AddPaymentMethod', {})}
          />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              Your methods ({list.length})
            </Text>
            {list.map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                expanded={expandedId === method.id}
                deleteConfirm={deleteConfirmId === method.id}
                loading={actionId === method.id}
                onToggleExpand={() => setExpandedId((cur) => (cur === method.id ? null : method.id))}
                onToggleActive={() =>
                  void runAction(method.id, () =>
                    actions.toggleActive(method.id, !isPaymentMethodActive(method)),
                  )
                }
                onDeletePress={() => setDeleteConfirmId(method.id)}
                onDeleteConfirm={() =>
                  void runAction(method.id, async () => {
                    await actions.remove(method.id);
                    setDeleteConfirmId(null);
                  })
                }
                onDeleteCancel={() => setDeleteConfirmId(null)}
                onEdit={() => navigation.navigate('AddPaymentMethod', { id: method.id, method })}
              />
            ))}

            {list.length > 0 && list.length < 4 ? (
              <View style={[styles.backup, { borderColor: `hsl(${theme.colors.brandPrimary} / 0.25)`, backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.06)` }]}>
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Add a backup method</Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 4 }}>
                  A second payout option helps if one bank or app is down during a trade.
                </Text>
                <SecondaryButton title="Add another" onPress={() => navigation.navigate('AddPaymentMethod', {})} style={{ marginTop: 10 }} />
              </View>
            ) : null}
          </>
        )}

        <View style={[styles.tips, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Before you trade</Text>
          <Text style={styles.tipItem}>• Use the legal name that matches your bank or UPI KYC.</Text>
          <Text style={styles.tipItem}>• Double-check account numbers and IFSC — buyers pay to these details.</Text>
          <Text style={styles.tipItem}>• Disable a method instead of deleting it if you might use it again.</Text>
        </View>

        <SecondaryButton
          title="Merchant dashboard"
          onPress={() => navigation.navigate('MerchantDashboard')}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  header: { marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  offline: { borderRadius: 8, padding: 10, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  backup: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  tips: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  tipItem: { color: '#888', fontSize: 13, lineHeight: 20, marginTop: 6 },
});
