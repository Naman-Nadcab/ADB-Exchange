import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection, marketing } from '@shared/theme';

type Props = {
  size?: number;
  compact?: boolean;
};

/** Opens the Account modal from any main-tab screen. */
export function AccountEntryButton({ size = 26, compact = false }: Props) {
  const navigation = useNavigation();

  const openAccount = () => {
    void hapticSelection();
    const root = navigation.getParent()?.getParent() as { navigate: (name: string, params?: object) => void } | undefined;
    root?.navigate('Account', { screen: 'AccountHome' });
  };

  return (
    <Pressable
      onPress={openAccount}
      style={[styles.btn, compact && styles.btnCompact, { borderColor: marketing.goldBorder }]}
      accessibilityRole="button"
      accessibilityLabel="Account"
    >
      <Ionicons name="person-circle-outline" size={size} color={marketing.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: marketing.insetHighlight,
  },
  btnCompact: { width: 32, height: 32, borderRadius: 16 },
});
