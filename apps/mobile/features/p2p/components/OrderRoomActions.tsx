import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, TextField, ErrorBanner, ExchangeCard } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import type { P2POrder } from '@exchange/mobile-types';
import {
  getOrderRoomPermissions,
  validateCancelReason,
  validateDisputeReason,
  validateTransactionReference,
  type OrderRoomRole,
} from '@core/domain/p2p/orderRoom';
import { ApiError } from '@core/api/errors/ApiError';
import type { PayProof } from '../hooks/useOrderRoomActions';

type Props = {
  order: P2POrder;
  role: OrderRoomRole;
  loading?: boolean;
  initialTxRef?: string;
  onPersistTxRef?: (ref: string) => void;
  onSubmitPay: (proof: PayProof, txRef: string) => Promise<void>;
  onVerify: () => Promise<void>;
  onRelease: () => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onDispute: (reason: string) => Promise<void>;
};

export function OrderRoomActions({
  order,
  role,
  loading,
  initialTxRef = '',
  onPersistTxRef,
  onSubmitPay,
  onVerify,
  onRelease,
  onCancel,
  onDispute,
}: Props) {
  const { theme } = useTheme();
  const perms = getOrderRoomPermissions(order, role);
  const success = semanticStatusPalette(theme.colors, 'success');
  const warning = semanticStatusPalette(theme.colors, 'warning');

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [payProof, setPayProof] = useState<PayProof | null>(null);
  const [txRef, setTxRef] = useState(initialTxRef);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [releaseTyped, setReleaseTyped] = useState('');
  const [disputeConfirmOpen, setDisputeConfirmOpen] = useState(false);

  const hintStyle = [
    theme.typography.bodySm,
    styles.hint,
    {
      color: warning.fg,
      borderColor: warning.border,
      backgroundColor: warning.bg,
      padding: theme.spacing[2.5],
      borderRadius: theme.radius.md,
    },
  ];

  const pickProof = async () => {
    hapticLight();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr('Photo library permission is required for payment proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPayProof({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? 'payment-proof.jpg',
    });
    setErr(null);
  };

  const handlePay = async () => {
    setErr(null);
    setOk(null);
    if (!payProof) {
      setErr('Upload a PNG or JPEG payment proof.');
      return;
    }
    const refErr = validateTransactionReference(txRef);
    if (refErr) {
      setErr(refErr);
      return;
    }
    try {
      await onSubmitPay(payProof, txRef.trim());
      setOk('Payment marked as paid. The seller will verify and release.');
      setPayProof(null);
      setTxRef('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Mark paid failed');
    }
  };

  const handleVerify = async () => {
    setErr(null);
    setOk(null);
    try {
      await onVerify();
      setOk('Payment verified. You can release crypto when ready.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Verify failed');
    }
  };

  const handleRelease = async () => {
    setErr(null);
    setOk(null);
    try {
      await onRelease();
      setOk('Crypto released.');
      setReleaseConfirmOpen(false);
      setReleaseTyped('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Release failed');
    }
  };

  const handleCancel = async () => {
    setErr(null);
    setOk(null);
    const validation = validateCancelReason(cancelReason);
    if (validation) {
      setErr(validation);
      return;
    }
    try {
      await onCancel(cancelReason.trim());
      setOk('Order cancelled.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Cancel failed');
    }
  };

  const handleDispute = async () => {
    setErr(null);
    setOk(null);
    const validation = validateDisputeReason(disputeReason);
    if (validation) {
      setErr(validation);
      return;
    }
    try {
      await onDispute(disputeReason.trim());
      setOk('Dispute opened.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Dispute failed');
    }
  };

  if (role === 'none') return null;

  return (
    <ExchangeCard style={{ marginBottom: theme.spacing[3], gap: theme.spacing[2.5] }}>
      <Text
        style={[
          theme.typography.headingSm,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
        ]}
      >
        Actions
      </Text>

      {err ? <ErrorBanner message={err} /> : null}
      {ok ? (
        <View
          style={[
            styles.okBanner,
            {
              borderColor: success.border,
              backgroundColor: success.bg,
              padding: theme.spacing[2.5],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, { color: success.fg, fontFamily: theme.fonts.sansSemiBold }]}>{ok}</Text>
        </View>
      ) : null}

      {perms.canPay ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2] },
            ]}
          >
            Upload a screenshot of your transfer and enter the transaction ID from your bank or payment app.
          </Text>
          <Pressable
            onPress={() => void pickProof()}
            style={[
              styles.uploadBox,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                borderRadius: theme.radius.md,
                padding: theme.spacing[4],
              },
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
              ]}
            >
              {payProof?.fileName ?? 'Tap to upload payment proof (PNG/JPEG)'}
            </Text>
          </Pressable>
          {payProof?.uri ? (
            <Image
              source={{ uri: payProof.uri }}
              style={[styles.preview, { borderRadius: theme.radius.md }]}
              resizeMode="cover"
            />
          ) : null}
          <TextField
            label="Transaction reference"
            value={txRef}
            onChangeText={(v) => {
              setTxRef(v);
              onPersistTxRef?.(v);
            }}
            placeholder="As shown on receipt"
          />
          <PrimaryButton
            title={loading ? 'Submitting…' : 'Mark as Paid'}
            loading={loading}
            disabled={!payProof || txRef.trim().length < 1}
            onPress={() => void handlePay()}
          />
        </View>
      ) : null}

      {role === 'seller' && order.status === 'payment_confirmed' && order.payment_verification_status === 'pending' ? (
        <Text style={hintStyle}>
          Check your account for the buyer&apos;s payment, review their proof and reference, then verify before releasing.
        </Text>
      ) : null}

      {perms.canVerify ? (
        <PrimaryButton title={loading ? 'Verifying…' : 'Verify Payment Received'} loading={loading} onPress={() => void handleVerify()} />
      ) : null}

      {perms.canRelease ? (
        <View style={{ gap: theme.spacing[2] }}>
          {!releaseConfirmOpen ? (
            <PrimaryButton
              title="Prepare Release"
              loading={loading}
              onPress={() => {
                setReleaseConfirmOpen(true);
                setReleaseTyped('');
              }}
            />
          ) : (
            <View
              style={[
                styles.confirmBox,
                {
                  borderColor: warning.border,
                  backgroundColor: warning.bg,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing[3],
                  gap: theme.spacing[2],
                },
              ]}
            >
              <Text style={[theme.typography.bodySm, { color: warning.fg }]}>
                Confirm payment is received before releasing escrow.
              </Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: `hsl(${theme.colors.foregroundSecondary})`, marginVertical: theme.spacing[1.5] },
                ]}
              >
                Order: {order.id.slice(0, 10)} · Amount: {order.quantity} {order.crypto_symbol ?? ''}
              </Text>
              <TextField
                label='Type RELEASE to continue'
                value={releaseTyped}
                onChangeText={setReleaseTyped}
                placeholder="RELEASE"
                autoCapitalize="characters"
              />
              <View style={[styles.row2, { gap: theme.spacing[2] }]}>
                <PrimaryButton
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setReleaseConfirmOpen(false);
                    setReleaseTyped('');
                  }}
                />
                <PrimaryButton
                  title={loading ? 'Releasing…' : 'Release Crypto'}
                  loading={loading}
                  disabled={releaseTyped.trim().toUpperCase() !== 'RELEASE'}
                  onPress={() => void handleRelease()}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {perms.canCancel ? (
        <View
          style={[
            { gap: theme.spacing[2], borderTopColor: `hsl(${theme.colors.borderDefault})` },
            styles.divider,
            { paddingTop: theme.spacing[2.5] },
          ]}
        >
          <TextField
            label="Cancel reason (required)"
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Why are you cancelling?"
          />
          <PrimaryButton
            title={loading ? 'Cancelling…' : 'Cancel Order'}
            variant="secondary"
            loading={loading}
            disabled={cancelReason.trim().length < 1}
            onPress={() => void handleCancel()}
          />
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Only available before payment is marked as paid.
          </Text>
        </View>
      ) : null}

      {perms.canDispute ? (
        <View
          style={[
            { gap: theme.spacing[2], borderTopColor: `hsl(${theme.colors.borderDefault})` },
            styles.divider,
            { paddingTop: theme.spacing[2.5] },
          ]}
        >
          <TextField
            label="Dispute reason (10–1000 characters)"
            value={disputeReason}
            onChangeText={setDisputeReason}
            placeholder="Describe the issue"
            multiline
          />
          {!disputeConfirmOpen ? (
            <PrimaryButton
              title="Review Dispute"
              variant="secondary"
              disabled={disputeReason.trim().length < 10}
              onPress={() => setDisputeConfirmOpen(true)}
            />
          ) : (
            <View
              style={[
                styles.confirmBox,
                {
                  borderColor: warning.border,
                  backgroundColor: warning.bg,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing[3],
                  gap: theme.spacing[2],
                },
              ]}
            >
              <Text style={[theme.typography.bodySm, { color: warning.fg }]}>
                Dispute escalation is irreversible for this order and will involve support review.
              </Text>
              <View style={[styles.row2, { gap: theme.spacing[2] }]}>
                <PrimaryButton title="Back" variant="secondary" onPress={() => setDisputeConfirmOpen(false)} />
                <PrimaryButton
                  title={loading ? 'Submitting…' : 'Raise Dispute'}
                  loading={loading}
                  disabled={disputeReason.trim().length < 10}
                  onPress={() => void handleDispute()}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {order.status === 'disputed' ? (
        <Text style={hintStyle}>
          This order is under dispute. Support will review. You cannot cancel or release from here.
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  section: {},
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  hint: { borderWidth: 1 },
  okBanner: { borderWidth: 1 },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  preview: { width: '100%', height: 140 },
  confirmBox: { borderWidth: 1 },
  row2: { flexDirection: 'row' },
});
