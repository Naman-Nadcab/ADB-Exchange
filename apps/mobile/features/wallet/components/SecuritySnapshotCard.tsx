import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, SkeletonList } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';

type Props = {
  loading: boolean;
  totpEnabled: boolean;
  hasEmail: boolean;
  onManageSecurity: () => void;
};

export function SecuritySnapshotCard({ loading, totpEnabled, hasEmail, onManageSecurity }: Props) {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');
  const muted = semanticStatusPalette(theme.colors, 'muted');
  const error = semanticStatusPalette(theme.colors, 'error');
  const brand = semanticStatusPalette(theme.colors, 'brand');

  return (
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5] }}>
      <View style={[styles.header, { gap: theme.spacing[2.5] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: brand.bg,
              width: theme.sizes.buttonSm + 4,
              height: theme.sizes.buttonSm + 4,
              borderRadius: theme.radius.md + 2,
            },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={theme.sizes.iconSm - 2} color={brand.fg} />
        </View>
        <View>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            Security
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            From your account
          </Text>
        </View>
      </View>

      {loading ? (
        <SkeletonList rows={2} />
      ) : (
        <View style={{ gap: theme.spacing[2], marginTop: theme.spacing[2.5] }}>
          <View
            style={[
              styles.row,
              {
                backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
                borderRadius: theme.radius.md + 2,
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[2.5],
              },
            ]}
          >
            <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundPrimary) }]}>
              Authenticator (2FA)
            </Text>
            <Text
              style={[
                theme.typography.labelSm,
                {
                  fontFamily: theme.fonts.sansBold,
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                  borderRadius: theme.radius.sm + 2,
                  overflow: 'hidden',
                  color: totpEnabled ? success.fg : muted.fg,
                  backgroundColor: totpEnabled ? success.bg : muted.bg,
                },
              ]}
            >
              {totpEnabled ? 'On' : 'Off'}
            </Text>
          </View>
          <View
            style={[
              styles.row,
              {
                backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
                borderRadius: theme.radius.md + 2,
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[2.5],
              },
            ]}
          >
            <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundPrimary) }]}>
              Email on file
            </Text>
            <Text
              style={[
                theme.typography.labelSm,
                {
                  fontFamily: theme.fonts.sansBold,
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                  borderRadius: theme.radius.sm + 2,
                  overflow: 'hidden',
                  color: hasEmail ? success.fg : error.fg,
                  backgroundColor: hasEmail ? success.bg : error.bg,
                },
              ]}
            >
              {hasEmail ? 'Yes' : 'Add'}
            </Text>
          </View>
        </View>
      )}

      <Pressable onPress={onManageSecurity} style={[styles.link, { gap: theme.spacing[1], marginTop: theme.spacing[2.5] }]}>
        <Text
          style={[
            theme.typography.bodySm,
            { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          Manage security
        </Text>
        <Ionicons name="chevron-forward" size={theme.sizes.iconXs - 2} color={hsl(theme.colors.brandPrimary)} />
      </Pressable>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center' },
});
