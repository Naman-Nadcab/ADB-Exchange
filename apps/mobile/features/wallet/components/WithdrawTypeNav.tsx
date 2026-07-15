import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Tab = 'crypto' | 'fiat';

type Props = {
  active: Tab;
  onCrypto: () => void;
  onFiat: () => void;
};

export function WithdrawTypeNav({ active, onCrypto, onFiat }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`, borderColor: `hsl(${theme.colors.borderDefault})` }]}>
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
        selected
          ? { backgroundColor: `hsl(${theme.colors.surfaceMuted})`, borderColor: `hsl(${theme.colors.borderDefault})` }
          : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={selected ? `hsl(${theme.colors.foregroundPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
      />
      <Text
        style={{
          color: selected ? `hsl(${theme.colors.foregroundPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
          fontWeight: selected ? '700' : '500',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    minHeight: 44,
  },
});
