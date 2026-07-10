import { View, StyleSheet } from 'react-native';
import { PrimaryButton } from '@shared/ui';
import type { P2POrder } from '@exchange/mobile-types';

type Props = {
  order: P2POrder;
  role: 'buyer' | 'seller';
  onMarkPaid?: () => void;
  onVerify?: () => void;
  onRelease?: () => void;
  onCancel?: () => void;
  onDispute?: () => void;
  loading?: boolean;
};

export function P2PActionBar({
  order,
  role,
  onMarkPaid,
  onVerify,
  onRelease,
  onCancel,
  onDispute,
  loading,
}: Props) {
  const status = order.status;
  return (
    <View style={styles.wrap}>
      {role === 'buyer' && (status === 'payment_pending' || status === 'escrow_funded') && onMarkPaid ? (
        <PrimaryButton title="I Have Paid" onPress={onMarkPaid} loading={loading} />
      ) : null}
      {role === 'seller' && status === 'payment_sent' && onVerify ? (
        <PrimaryButton title="Verify Payment" onPress={onVerify} loading={loading} />
      ) : null}
      {role === 'seller' && status === 'payment_confirmed' && onRelease ? (
        <PrimaryButton title="Release Crypto" onPress={onRelease} loading={loading} />
      ) : null}
      {['payment_pending', 'payment_sent', 'escrow_funded', 'created'].includes(status) && onCancel ? (
        <PrimaryButton title="Cancel Order" variant="secondary" onPress={onCancel} />
      ) : null}
      {status === 'payment_confirmed' && onDispute ? (
        <PrimaryButton title="Open Dispute" variant="secondary" onPress={onDispute} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 12 },
});
