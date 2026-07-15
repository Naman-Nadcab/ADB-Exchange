import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import type { WalletStackParamList } from '../navigation/types';

export function TransferInfoCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<WalletStackParamList>>();

  const bullets = [
    'Instant transfers between accounts',
    'No transaction fees',
    'Available 24/7',
  ];

  const links = [
    { label: 'Deposit Crypto', screen: 'DepositHome' as const },
    { label: 'Withdraw Crypto', screen: 'WithdrawHome' as const },
    { label: 'Convert Assets', screen: 'Convert' as const },
  ];

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={20} color={`hsl(${theme.colors.brandPrimary})`} />
        <View>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>Internal Transfer</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>Quick & Free</Text>
        </View>
      </View>
      {bullets.map((b) => (
        <View key={b} style={styles.bullet}>
          <Ionicons name="checkmark-circle" size={14} color={`hsl(${theme.colors.tradeBuy})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, flex: 1 }}>{b}</Text>
        </View>
      ))}
      <Text style={[styles.linksTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Quick Links</Text>
      {links.map((l) => (
        <Pressable key={l.label} onPress={() => navigation.navigate(l.screen)} style={styles.link}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>{l.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
        </Pressable>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  linksTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginTop: 8 },
  link: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, minHeight: 40 },
});
