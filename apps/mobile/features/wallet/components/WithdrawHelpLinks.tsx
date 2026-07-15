import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@shared/theme';
import type { WalletStackParamList } from '../navigation/types';

const LINKS = [
  { label: 'Withdrawal FAQs', screen: 'WithdrawalHistory' as const },
  { label: 'Withdrawal limits', account: 'WithdrawalLimits' as const },
  { label: 'Manage address book', screen: 'AddressBook' as const },
  { label: 'Withdrawal history', screen: 'WithdrawalHistory' as const },
];

export function WithdrawHelpLinks() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<WalletStackParamList>>();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Help</Text>
      {LINKS.map((link) => (
        <Pressable
          key={link.label}
          onPress={() => {
            if ('account' in link) {
              navigation.getParent()?.navigate('Account', { screen: link.account });
            } else {
              navigation.navigate(link.screen);
            }
          }}
          style={styles.row}
        >
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 16 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 6 },
  row: { paddingVertical: 8, minHeight: 36 },
});
