import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const success = semanticStatusPalette(theme.colors, 'success');
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const error = semanticStatusPalette(theme.colors, 'error');

  const copyValue = async (key: string, value: string) => {
    hapticLight();
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <ExchangeCard
      style={{
        marginBottom: theme.spacing[2.5],
        opacity: active ? 1 : theme.opacity.muted,
      }}
    >
      <View style={[styles.row, { gap: theme.spacing[3] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              width: 44,
              height: 44,
              borderRadius: theme.radius.lg,
              backgroundColor: active ? `hsl(${theme.colors.brandPrimary} / 0.12)` : `hsl(${theme.colors.surfaceMuted})`,
            },
          ]}
        >
          <Ionicons
            name={methodIconName(method.method_code)}
            size={theme.sizes.iconMd}
            color={active ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.titleRow, { gap: theme.spacing[2] }]}>
            <Text
              style={[
                theme.typography.headingSm,
                {
                  color: `hsl(${theme.colors.foregroundPrimary})`,
                  fontFamily: theme.fonts.sansBold,
                  flexShrink: 1,
                },
              ]}
              numberOfLines={1}
            >
              {paymentMethodTitle(method)}
            </Text>
            <StatusChip label={active ? 'Active' : 'Disabled'} tone={active ? 'live' : 'neutral'} />
          </View>
          {paymentMethodSubtitle(method) ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              {paymentMethodSubtitle(method)}
            </Text>
          ) : null}
          <View style={[styles.metaRow, { gap: theme.spacing[2], marginTop: theme.spacing[2] }]}>
            <View
              style={[
                styles.privateBadge,
                {
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: theme.spacing[1.5],
                  paddingVertical: theme.spacing[0.5],
                  gap: theme.spacing[1],
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={theme.sizes.iconXs} color={`hsl(${theme.colors.foregroundSecondary})`} />
              <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                Private until trade
              </Text>
            </View>
            {verify ? (
              <Text
                style={[
                  theme.typography.labelSm,
                  { color: verify.tone === 'verified' ? success.fg : warning.fg },
                ]}
              >
                {verify.label}
              </Text>
            ) : null}
            {updated ? (
              <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                Updated {updated}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[3] }]}>
        {details.length > 0 ? (
          <Pressable
            onPress={onToggleExpand}
            style={[
              styles.actionBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                borderRadius: theme.radius.md,
                minWidth: theme.sizes.tapTarget,
                height: theme.sizes.tapTarget,
              },
            ]}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={theme.sizes.iconMd}
              color={`hsl(${theme.colors.foregroundSecondary})`}
            />
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            style={[
              styles.actionBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                borderRadius: theme.radius.md,
                minWidth: theme.sizes.tapTarget,
                height: theme.sizes.tapTarget,
              },
            ]}
          >
            <Ionicons name="create-outline" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onToggleActive}
          disabled={loading}
          style={[
            styles.toggleBtn,
            {
              borderColor: active ? warning.border : success.border,
              borderRadius: theme.radius.md,
              height: theme.sizes.tapTarget,
              paddingHorizontal: theme.spacing[3.5],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodySm,
              {
                fontFamily: theme.fonts.sansSemiBold,
                color: active ? warning.fg : success.fg,
              },
            ]}
          >
            {active ? 'Disable' : 'Enable'}
          </Text>
        </Pressable>
        {deleteConfirm ? (
          <>
            <Pressable
              onPress={onDeleteConfirm}
              disabled={loading}
              style={[
                styles.confirmBtn,
                {
                  borderColor: error.border,
                  borderRadius: theme.radius.md,
                  height: theme.sizes.tapTarget,
                  paddingHorizontal: theme.spacing[3],
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: error.fg, fontFamily: theme.fonts.sansBold },
                ]}
              >
                Confirm
              </Text>
            </Pressable>
            <Pressable
              onPress={onDeleteCancel}
              style={[
                styles.actionBtn,
                {
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  borderRadius: theme.radius.md,
                  minWidth: theme.sizes.tapTarget,
                  height: theme.sizes.tapTarget,
                },
              ]}
            >
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onDeletePress}
            style={[
              styles.actionBtn,
              {
                borderColor: `hsl(${theme.colors.borderDefault})`,
                borderRadius: theme.radius.md,
                minWidth: theme.sizes.tapTarget,
                height: theme.sizes.tapTarget,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={theme.sizes.iconMd} color={error.fg} />
          </Pressable>
        )}
      </View>

      {expanded && details.length > 0 ? (
        <View
          style={[
            styles.details,
            {
              borderTopColor: `hsl(${theme.colors.borderDefault})`,
              marginTop: theme.spacing[3],
              paddingTop: theme.spacing[3],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansBold,
                marginBottom: theme.spacing[2],
              },
            ]}
          >
            ACCOUNT DETAILS
          </Text>
          {details.map(([k, v]) => {
            const copyId = `${method.id}-${k}`;
            return (
              <View
                key={k}
                style={[
                  styles.detailRow,
                  {
                    borderColor: `hsl(${theme.colors.borderDefault})`,
                    borderRadius: theme.radius.md,
                    padding: theme.spacing[2.5],
                    marginBottom: theme.spacing[2],
                    gap: theme.spacing[2.5],
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                    {formatPaymentDetailLabel(k)}
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      {
                        color: `hsl(${theme.colors.foregroundPrimary})`,
                        fontFamily: theme.fonts.sansSemiBold,
                        marginTop: theme.spacing[0.5],
                      },
                    ]}
                  >
                    {v}
                  </Text>
                </View>
                <Pressable onPress={() => void copyValue(copyId, v)}>
                  <Ionicons
                    name={copiedKey === copyId ? 'checkmark-circle' : 'copy-outline'}
                    size={theme.sizes.iconSm}
                    color={copiedKey === copyId ? success.fg : `hsl(${theme.colors.foregroundSecondary})`}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  actionBtn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  toggleBtn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  details: { borderTopWidth: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', borderWidth: 1 },
});
