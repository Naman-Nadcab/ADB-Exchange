import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../ui/data/Avatar';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';

type AssetProps = {
  variant: 'asset';
  symbol: string;
  name?: string;
  network?: string;
  available?: string;
  enabled?: boolean;
  enabledLabel?: string;
  disabledLabel?: string;
  step?: string;
  testID?: string;
};

type TextProps = {
  variant: 'text';
  title: string;
  subtitle?: string;
  step?: string;
  testID?: string;
};

type Props = AssetProps | TextProps;

/** Unified wallet flow header — asset (deposit/withdraw) or text-only (transfer/convert). */
export function FlowHeader(props: Props) {
  const { theme } = useTheme();

  if (props.variant === 'text') {
    const { title, subtitle, step, testID } = props;
    return (
      <View testID={testID} style={[styles.wrap, { marginBottom: theme.spacing.sectionGap }]}>
        <Text
          style={[
            theme.typography.headingLg,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
        {step ? (
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.brandPrimary})`,
                fontFamily: theme.fonts.sansSemiBold,
                marginTop: theme.spacing[2],
              },
            ]}
          >
            {step}
          </Text>
        ) : null}
      </View>
    );
  }

  const {
    symbol,
    name,
    network,
    available,
    enabled,
    enabledLabel = 'ON',
    disabledLabel = 'MAINTENANCE',
    step,
    testID,
  } = props;
  const statusTone = enabled === false ? 'warning' : 'buy';
  const statusPalette = semanticStatusPalette(theme.colors, statusTone);

  return (
    <View testID={testID} style={[styles.wrap, { marginBottom: theme.spacing[3.5] }]}>
      <View style={[styles.row, { gap: theme.spacing[3] }]}>
        <Avatar name={symbol} size="md" />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.headingMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {name ?? symbol}
          </Text>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            {symbol}
          </Text>
          {available != null ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              Available: {available} {symbol}
            </Text>
          ) : null}
        </View>
        {enabled != null ? (
          <View
            style={[
              styles.badge,
              {
                borderRadius: theme.radius.sm + 2,
                paddingHorizontal: theme.spacing[2],
                paddingVertical: theme.spacing[1],
                backgroundColor: enabled ? statusPalette.bg : semanticStatusPalette(theme.colors, 'warning').bg,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.labelSm,
                {
                  color: enabled ? statusPalette.fg : semanticStatusPalette(theme.colors, 'warning').fg,
                  fontFamily: theme.fonts.sansBold,
                },
              ]}
            >
              {enabled ? enabledLabel : disabledLabel}
            </Text>
          </View>
        ) : null}
      </View>
      {network ? (
        <View style={[styles.networkRow, { gap: theme.spacing[1.5], marginTop: theme.spacing[2] }]}>
          <Ionicons
            name="git-network-outline"
            size={theme.sizes.iconSm}
            color={`hsl(${theme.colors.foregroundSecondary})`}
          />
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            {network}
          </Text>
        </View>
      ) : null}
      {step ? (
        <Text
          style={[
            theme.typography.labelSm,
            {
              color: `hsl(${theme.colors.brandPrimary})`,
              fontFamily: theme.fonts.sansSemiBold,
              marginTop: theme.spacing[1.5],
            },
          ]}
        >
          {step}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { alignSelf: 'flex-start' },
  networkRow: { flexDirection: 'row', alignItems: 'center' },
});
