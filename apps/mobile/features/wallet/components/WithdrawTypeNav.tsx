import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';

type Tab = 'crypto' | 'fiat';

type Props = {
  active: Tab;
  onCrypto: () => void;
  onFiat: () => void;
};

export function WithdrawTypeNav({ active, onCrypto, onFiat }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`,
          borderColor: hsl(theme.colors.borderDefault),
          gap: theme.spacing[1],
          padding: theme.spacing[1],
          borderRadius: theme.radius.lg,
          marginBottom: theme.spacing[3.5],
        },
      ]}
    >
      <TabButton
        label="Crypto"
        icon="logo-bitcoin"
        selected={active === 'crypto'}
        onPress={onCrypto}
        theme={theme}
      />
      <TabButton
        label="INR (Fiat)"
        icon="cash-outline"
        selected={active === 'fiat'}
        onPress={onFiat}
        theme={theme}
      />
    </View>
  );
}

function TabButton({
  label,
  icon,
  selected,
  onPress,
  theme,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tab,
        {
          gap: theme.spacing[1.5],
          paddingVertical: theme.spacing[2.5],
          borderRadius: theme.radius.md,
          minHeight: theme.sizes.tapTarget,
        },
        selected
          ? {
              backgroundColor: hsl(theme.colors.surfaceMuted),
              borderColor: hsl(theme.colors.borderDefault),
            }
          : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={theme.sizes.iconXs}
        color={selected ? hsl(theme.colors.foregroundPrimary) : hsl(theme.colors.foregroundSecondary)}
      />
      <Text
        style={[
          theme.typography.bodyMd,
          {
            color: selected ? hsl(theme.colors.foregroundPrimary) : hsl(theme.colors.foregroundSecondary),
            fontFamily: selected ? theme.fonts.sansBold : theme.fonts.sansMedium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
