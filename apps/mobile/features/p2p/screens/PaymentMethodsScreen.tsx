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
  ExchangeCard,
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

      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        contentContainerStyle={{ paddingBottom: theme.spacing[7] }}
      >
        <View style={{ marginBottom: theme.spacing[3.5] }}>
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            P2P · PAYMENTS
          </Text>
          <Text
            style={[
              theme.typography.displayMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                marginTop: theme.spacing[1],
              },
            ]}
          >
            Payment methods
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
          >
            Add how you receive fiat for P2P trades. Details stay private until you match with a counterparty.
          </Text>
        </View>

        <PrimaryButton title="Add method" onPress={() => navigation.navigate('AddPaymentMethod', {})} />

        {list.length > 0 ? (
          <View style={[styles.summaryRow, { gap: theme.spacing[2], marginVertical: theme.spacing[3] }]}>
            <ExchangeCard style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }]}>
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold }]}>
                {counts.active}
              </Text>
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}> active</Text>
            </ExchangeCard>
            {counts.disabled > 0 ? (
              <ExchangeCard style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }]}>
                <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold }]}>
                  {counts.disabled}
                </Text>
                <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}> disabled</Text>
              </ExchangeCard>
            ) : null}
            <ExchangeCard style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }]}>
              <Ionicons name="lock-closed-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}> Shown only during trades</Text>
            </ExchangeCard>
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
            <Text
              style={[
                theme.typography.headingSm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansBold,
                  marginTop: theme.spacing[2],
                  marginBottom: theme.spacing[2],
                },
              ]}
            >
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
              <ExchangeCard
                style={{
                  marginTop: theme.spacing[2],
                  borderColor: `hsl(${theme.colors.brandPrimary} / 0.25)`,
                  backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.06)`,
                }}
              >
                <Text
                  style={[
                    theme.typography.bodyMd,
                    { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                  ]}
                >
                  Add a backup method
                </Text>
                <Text
                  style={[
                    theme.typography.bodySm,
                    { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                  ]}
                >
                  A second payout option helps if one bank or app is down during a trade.
                </Text>
                <SecondaryButton title="Add another" onPress={() => navigation.navigate('AddPaymentMethod', {})} style={{ marginTop: theme.spacing[2.5] }} />
              </ExchangeCard>
            ) : null}
          </>
        )}

        <ExchangeCard style={{ marginTop: theme.spacing[4] }}>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            Before you trade
          </Text>
          <Text style={[theme.typography.bodySm, styles.tipItem, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1.5] }]}>
            • Use the legal name that matches your bank or UPI KYC.
          </Text>
          <Text style={[theme.typography.bodySm, styles.tipItem, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            • Double-check account numbers and IFSC — buyers pay to these details.
          </Text>
          <Text style={[theme.typography.bodySm, styles.tipItem, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            • Disable a method instead of deleting it if you might use it again.
          </Text>
        </ExchangeCard>

        <SecondaryButton
          title="Merchant dashboard"
          onPress={() => navigation.navigate('MerchantDashboard')}
          style={{ marginTop: theme.spacing[3] }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {},
  tipItem: { marginTop: 6 },
  offline: {},
});
