import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection, useTheme } from '@shared/theme';

type Props = {
  size?: number;
  compact?: boolean;
};

/** Opens the Account modal from any main-tab screen. */
export function AccountEntryButton({ size, compact = false }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const iconSize = size ?? theme.sizes.iconMd;
  const { marketing: m } = theme;

  const openAccount = () => {
    void hapticSelection();
    const root = navigation.getParent()?.getParent() as { navigate: (name: string, params?: object) => void } | undefined;
    root?.navigate('Account', { screen: 'AccountHome' });
  };

  const dimension = compact ? theme.sizes.buttonSm : theme.sizes.buttonMd;

  return (
    <Pressable
      onPress={openAccount}
      style={[
        styles.btn,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderColor: m.goldBorder,
          backgroundColor: m.insetHighlight,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Account"
    >
      <Ionicons name="person-circle-outline" size={iconSize} color={m.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
