import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

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
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconBg ?? `hsl(${theme.colors.brandPrimary} / 0.1)` },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={iconColor ?? `hsl(${theme.colors.brandPrimary})`}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', fontSize: 14, color: `hsl(${theme.colors.foregroundPrimary})` }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
