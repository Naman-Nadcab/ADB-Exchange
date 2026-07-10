import { useEffect, useState } from 'react';
import { ScrollView, Text, Modal, View, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useAppStore } from '@core/state/appStore';
import { buildEscrowTimeline, displayOrderStatus } from '@core/domain/p2p/order';
import { useP2PStore } from '@core/state/p2pStore';
import {
  useP2POrder,
  useP2POrderActions,
  useP2PMessages,
  useSendP2PMessage,
  useMarkMessagesRead,
  useP2PSubscriptions,
} from '../hooks/useP2P';
import { OrderTimeline } from '../components/OrderTimeline';
import { P2PChatPanel } from '../components/P2PChatPanel';
import { P2PActionBar } from '../components/P2PActionBar';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'OrderRoom'>;

export function OrderRoomScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const isOnline = useAppStore((s) => s.isOnline);
  const orderQ = useP2POrder(orderId);
  const actions = useP2POrderActions(orderId);
  const messagesQ = useP2PMessages(orderId);
  const sendMsg = useSendP2PMessage(orderId);
  const markRead = useMarkMessagesRead(orderId);
  const typingUserId = useP2PStore((s) => s.typingUserIdByOrder[orderId]);
  const { sendTyping } = useP2PSubscriptions(orderId);

  const [showPay, setShowPay] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-610');
  }, []);

  useEffect(() => {
    const msgs = messagesQ.messages;
    const last = msgs[msgs.length - 1];
    if (last?.id && !last._pending) void markRead.mutate(last.id);
  }, [messagesQ.messages, markRead]);

  const order = orderQ.data;
  if (!order) {
    return (
      <ScreenLayout testID="S-610">
        <Text>Loading order…</Text>
      </ScreenLayout>
    );
  }

  const role = userId === order.buyer_id ? 'buyer' : 'seller';
  const timeline = buildEscrowTimeline(order.status);

  const confirmPaid = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline');
      return;
    }
    try {
      await actions.confirmPayment.mutateAsync({
        transaction_reference: txRef.trim() || undefined,
        proof_url: proofUrl.trim() || undefined,
      });
      setShowPay(false);
    } catch {
      setError('Payment confirmation failed');
    }
  };

  const openDispute = async () => {
    if (disputeReason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }
    try {
      const res = await actions.openDispute.mutateAsync({
        reason: disputeReason.trim(),
        evidence: proofUrl.trim() ? [proofUrl.trim()] : undefined,
      });
      setShowDispute(false);
      if (res?.id) navigation.navigate('DisputeDetail', { disputeId: res.id });
    } catch {
      setError('Failed to open dispute');
    }
  };

  return (
    <ScreenLayout testID="S-610">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {order.crypto_symbol} · {displayOrderStatus(order.status)}
        </Text>
        <Text>Quantity: {order.quantity}</Text>
        <Text>Fiat: {order.fiat_amount ?? '—'} {order.fiat_currency}</Text>
        {order.expires_at ? <Text>Expires: {new Date(order.expires_at).toLocaleString()}</Text> : null}
        <OrderTimeline steps={timeline} />
        <P2PActionBar
          order={order}
          role={role}
          loading={actions.confirmPayment.isPending || actions.release.isPending}
          onMarkPaid={() => setShowPay(true)}
          onVerify={() => void actions.verifyPayment.mutateAsync()}
          onRelease={() =>
            Alert.alert('Release crypto?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Release', onPress: () => void actions.release.mutateAsync() },
            ])
          }
          onCancel={() =>
            Alert.alert('Cancel order?', '', [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: () => void actions.cancel.mutateAsync('User cancelled') },
            ])
          }
          onDispute={() => setShowDispute(true)}
        />
        {error ? <ErrorBanner message={error} /> : null}
        <P2PChatPanel
          messages={messagesQ.messages}
          typingUserId={typingUserId}
          currentUserId={userId}
          sending={sendMsg.isPending}
          onTyping={sendTyping}
          onSend={(text) => void sendMsg.mutateAsync(text)}
        />
      </ScrollView>

      <Modal visible={showPay} transparent animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Payment proof (M-601)</Text>
          <TextField label="Transaction reference" value={txRef} onChangeText={setTxRef} />
          <TextField label="Proof URL (optional)" value={proofUrl} onChangeText={setProofUrl} />
          <PrimaryButton title="Confirm Paid" onPress={() => void confirmPaid()} />
          <PrimaryButton title="Cancel" variant="secondary" onPress={() => setShowPay(false)} />
        </View>
      </Modal>

      <Modal visible={showDispute} transparent animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Open dispute (M-602)</Text>
          <TextField label="Reason" value={disputeReason} onChangeText={setDisputeReason} />
          <TextField label="Evidence URL" value={proofUrl} onChangeText={setProofUrl} />
          <PrimaryButton title="Submit" onPress={() => void openDispute()} />
          <PrimaryButton title="Cancel" variant="secondary" onPress={() => setShowDispute(false)} />
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modal: { marginTop: 'auto', backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontWeight: '700', marginBottom: 12 },
});
