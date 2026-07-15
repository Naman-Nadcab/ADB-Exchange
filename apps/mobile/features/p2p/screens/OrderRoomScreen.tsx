import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, StyleSheet, RefreshControl, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  SkeletonList,
  ErrorBanner,
  ErrorState,
  TerminalPanel,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { useP2PStore } from '@core/state/p2pStore';
import {
  buildOrderStatusTimeline,
  getOrderRoomPermissions,
  resolveOrderRole,
} from '@core/domain/p2p/orderRoom';
import {
  useP2POrder,
  useP2PMessages,
  useSendP2PMessage,
  useMarkMessagesRead,
  useP2PSubscriptions,
  P2POrderNotFoundError,
} from '../hooks/useP2P';
import { useOrderRoomActions } from '../hooks/useOrderRoomActions';
import { OrderRoomTimer } from '../components/OrderRoomTimer';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { OrderRoomSummary, OrderRoomHeader, copyOrderId } from '../components/OrderRoomSummary';
import { OrderPaymentInstructions } from '../components/OrderPaymentInstructions';
import { OrderRoomActions } from '../components/OrderRoomActions';
import { P2PChatPanel } from '../components/P2PChatPanel';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'OrderRoom'>;

export function OrderRoomScreen({ navigation, route }: Props) {
  const { orderId, order: seedOrder } = route.params;
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const isOnline = useAppStore((s) => s.isOnline);
  const orderQ = useP2POrder(orderId, seedOrder);
  const actions = useOrderRoomActions(orderId);
  const typingUserId = useP2PStore((s) => s.typingUserIdByOrder[orderId]);
  const { sendTyping } = useP2PSubscriptions(orderId);

  const order = orderQ.data;
  const role = order ? resolveOrderRole(order, userId) : 'none';
  const permissions = order ? getOrderRoomPermissions(order, role) : null;
  const messagesQ = useP2PMessages(orderId, permissions?.chatEnabled ?? false);
  const sendMsg = useSendP2PMessage(orderId);
  const markRead = useMarkMessagesRead(orderId);

  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const draftTxRef = useMemo(() => actions.readDraft().txRef ?? '', [actions]);

  useEffect(() => {
    analytics.screen('S-610');
  }, []);

  useEffect(() => {
    const msgs = messagesQ.messages;
    const last = msgs[msgs.length - 1];
    if (last?.id && !last._pending) void markRead.mutate(last.id);
  }, [messagesQ.messages, markRead]);

  const onRefresh = useCallback(() => {
    void orderQ.refetch();
    void messagesQ.refetch();
  }, [orderQ, messagesQ]);

  const onCopyId = async () => {
    await copyOrderId(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wrapAction = async (fn: () => Promise<void>) => {
    if (!isOnline) throw new Error('Offline');
    setActionLoading(true);
    try {
      await fn();
    } finally {
      setActionLoading(false);
    }
  };

  if (orderQ.isLoading && !order) {
    return (
      <ScreenLayout testID="S-610">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (orderQ.isError && !order) {
    const notFound = orderQ.error instanceof P2POrderNotFoundError;
    return (
      <ScreenLayout testID="S-610">
        <ErrorState
          title={notFound ? 'Order not found' : 'Could not load this order'}
          message={notFound ? 'It may have been removed or you do not have access.' : undefined}
          onRetry={() => void orderQ.refetch()}
        />
      </ScreenLayout>
    );
  }

  if (!order) {
    return (
      <ScreenLayout testID="S-610">
        <ErrorState title="Order not found" onRetry={() => void orderQ.refetch()} />
      </ScreenLayout>
    );
  }

  if (role === 'none') {
    return (
      <ScreenLayout testID="S-610">
        <ErrorBanner message="You do not have access to this order." />
      </ScreenLayout>
    );
  }

  const isBuyer = role === 'buyer';
  const timeline = buildOrderStatusTimeline(order.status);
  const details = order.seller_payment_details as Record<string, unknown> | undefined;

  return (
    <ScreenLayout testID="S-610">
      {!isOnline ? (
        <View style={[styles.offline, { backgroundColor: `hsl(${theme.colors.statusError} / 0.08)` }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={`hsl(${theme.colors.statusError})`} />
          <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 13, flex: 1 }}>
            Offline — actions are disabled until you reconnect.
          </Text>
          <Pressable onPress={() => void orderQ.refetch()}>
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        refreshControl={<RefreshControl refreshing={orderQ.isFetching} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <OrderRoomHeader orderId={orderId} onCopy={() => void onCopyId()} copied={copied} />

        <OrderRoomTimer
          expiresAtIso={order.expires_at}
          active={permissions?.timerActive ?? false}
          onExpire={() => void orderQ.refetch()}
        />

        <OrderStatusTimeline steps={timeline} />

        {order.status === 'expired' ? (
          <TerminalPanel subtle style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', marginBottom: 4, color: `hsl(${theme.colors.foregroundPrimary})` }}>Order expired</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>The payment window has closed.</Text>
          </TerminalPanel>
        ) : null}
        {order.status === 'cancelled' ? (
          <TerminalPanel subtle style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', marginBottom: 4, color: `hsl(${theme.colors.foregroundPrimary})` }}>Order cancelled</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{order.cancel_reason ?? 'This order was cancelled.'}</Text>
          </TerminalPanel>
        ) : null}
        {order.status === 'completed' || order.status === 'released' ? (
          <TerminalPanel subtle style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', marginBottom: 4, color: `hsl(${theme.colors.foregroundPrimary})` }}>Order completed</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Crypto has been released successfully.</Text>
          </TerminalPanel>
        ) : null}

        <OrderRoomSummary order={order} isBuyer={isBuyer} />

        {isBuyer && order.status === 'payment_pending' && details ? (
          <OrderPaymentInstructions details={details} displayName={order.seller_payment_display_name} />
        ) : null}

        <OrderRoomActions
          order={order}
          role={role}
          loading={actionLoading || actions.isLocked()}
          initialTxRef={draftTxRef}
          onPersistTxRef={actions.persistTxRef}
          onSubmitPay={(proof, txRef) => wrapAction(() => actions.submitPay(proof, txRef).then(() => undefined))}
          onVerify={() => wrapAction(() => actions.verifyPayment().then(() => undefined))}
          onRelease={() => wrapAction(() => actions.release().then(() => undefined))}
          onCancel={(reason) => wrapAction(() => actions.cancel(reason).then(() => undefined))}
          onDispute={async (reason) => {
            await wrapAction(async () => {
              const res = await actions.openDispute(reason);
              if (res?.id) navigation.navigate('DisputeDetail', { disputeId: res.id });
            });
          }}
        />

        <P2PChatPanel
          messages={messagesQ.messages}
          typingUserId={typingUserId}
          currentUserId={userId}
          enabled={(permissions?.chatEnabled ?? false) && isOnline}
          sending={sendMsg.isPending}
          onTyping={sendTyping}
          onSend={(text) => void sendMsg.mutateAsync(text)}
          onResend={(text) => void sendMsg.mutateAsync(text)}
        />

        {order.dispute_id ? (
          <Pressable
            onPress={() => navigation.navigate('DisputeDetail', { disputeId: order.dispute_id! })}
            style={{ marginTop: 8 }}
          >
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>View dispute</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
});
