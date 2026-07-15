import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, hapticLight } from '@shared/theme';
import type { P2PUserPaymentMethod } from '@exchange/mobile-types';
import {
  formatPaymentDetailLabel,
  isPaymentMethodActive,
  methodIconName,
  paymentMethodDetailEntries,
  paymentMethodSubtitle,
  paymentMethodTitle,
  paymentMethodUpdatedLabel,
  verificationBadge,
} from '@core/domain/p2p/paymentMethods';

type Props = {
  method: P2PUserPaymentMethod;
  expanded: boolean;
  deleteConfirm: boolean;
  loading?: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onDeletePress: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEdit?: () => void;
};

export function PaymentMethodCard({
  method,
  expanded,
  deleteConfirm,
  loading,
  onToggleExpand,
  onToggleActive,
  onDeletePress,
  onDeleteConfirm,
  onDeleteCancel,
  onEdit,
}: Props) {
  const { theme } = useTheme();
  const active = isPaymentMethodActive(method);
  const details = paymentMethodDetailEntries(method);
  const updated = paymentMethodUpdatedLabel(method);
  const verify = verificationBadge(method);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyValue = async (key: string, value: string) => {
    hapticLight();
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: active ? `hsl(${theme.colors.borderDefault})` : `hsl(${theme.colors.borderDefault} / 0.6)`,
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          opacity: active ? 1 : 0.92,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: active ? `hsl(${theme.colors.brandPrimary} / 0.12)` : `hsl(${theme.colors.surfaceMuted})` }]}>
          <Ionicons
            name={methodIconName(method.method_code)}
            size={20}
            color={active ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: `hsl(${theme.colors.foregroundPrimary})`, flexShrink: 1 }} numberOfLines={1}>
              {paymentMethodTitle(method)}
            </Text>
            <View style={[styles.badge, { backgroundColor: active ? 'rgba(14,203,129,0.12)' : `hsl(${theme.colors.surfaceMuted})` }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#0ecb81' : `hsl(${theme.colors.foregroundSecondary})` }}>
                {active ? 'Active' : 'Disabled'}
              </Text>
            </View>
          </View>
          {paymentMethodSubtitle(method) ? (
            <Text style={{ fontSize: 13, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
              {paymentMethodSubtitle(method)}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.privateBadge, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Ionicons name="lock-closed-outline" size={11} color={`hsl(${theme.colors.foregroundSecondary})`} />
              <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>Private until trade</Text>
            </View>
            {verify ? (
              <Text style={{ fontSize: 11, color: verify.tone === 'verified' ? '#0ecb81' : '#f59e0b' }}>{verify.label}</Text>
            ) : null}
            {updated ? <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>Updated {updated}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {details.length > 0 ? (
          <Pressable onPress={onToggleExpand} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable onPress={onEdit} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Ionicons name="create-outline" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onToggleActive}
          disabled={loading}
          style={[styles.toggleBtn, { borderColor: active ? 'rgba(245,158,11,0.35)' : 'rgba(14,203,129,0.35)' }]}
        >
          <Text style={{ fontWeight: '600', color: active ? '#f59e0b' : '#0ecb81' }}>{active ? 'Disable' : 'Enable'}</Text>
        </Pressable>
        {deleteConfirm ? (
          <>
            <Pressable onPress={onDeleteConfirm} disabled={loading} style={[styles.confirmBtn, { borderColor: 'rgba(246,70,93,0.35)' }]}>
              <Text style={{ color: '#f6465d', fontWeight: '700', fontSize: 12 }}>Confirm</Text>
            </Pressable>
            <Pressable onPress={onDeleteCancel} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onDeletePress} style={[styles.actionBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Ionicons name="trash-outline" size={18} color="#f6465d" />
          </Pressable>
        )}
      </View>

      {expanded && details.length > 0 ? (
        <View style={[styles.details, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }}>
            ACCOUNT DETAILS
          </Text>
          {details.map(([k, v]) => {
            const copyId = `${method.id}-${k}`;
            return (
              <View key={k} style={[styles.detailRow, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>{formatPaymentDetailLabel(k)}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 2 }}>{v}</Text>
                </View>
                <Pressable onPress={() => void copyValue(copyId, v)}>
                  <Ionicons
                    name={copiedKey === copyId ? 'checkmark-circle' : 'copy-outline'}
                    size={16}
                    color={copiedKey === copyId ? '#0ecb81' : `hsl(${theme.colors.foregroundSecondary})`}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  actionBtn: { minWidth: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  toggleBtn: { height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  confirmBtn: { height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  detailRow: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
});
