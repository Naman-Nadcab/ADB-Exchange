import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  onPress: () => void;
  disabled?: boolean;
};

export function WalletQuickToolLink({ title, subtitle, icon, iconBg, iconColor, onPress, disabled }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.link,
        {
          gap: theme.spacing[2.5],
          borderRadius: theme.radius.lg,
          padding: theme.spacing[3],
          minHeight: theme.listDensity.asset.rowHeight + 8,
          borderColor: hsl(theme.colors.borderDefault),
          backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
          opacity: disabled ? theme.opacity.disabled : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            width: 36,
            height: 36,
            borderRadius: theme.radius.md + 2,
            backgroundColor: iconBg ?? `hsl(${theme.colors.brandPrimary} / 0.1)`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={theme.sizes.iconSm - 2}
          color={iconColor ?? hsl(theme.colors.brandPrimary)}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.bodyMd,
            { fontFamily: theme.fonts.sansSemiBold, color: hsl(theme.colors.foregroundPrimary) },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[0.5] },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundSecondary)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
