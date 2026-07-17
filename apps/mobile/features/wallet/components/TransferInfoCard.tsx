import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { ExchangeCard } from '@shared/ui';
import type { WalletStackParamList } from '../navigation/types';

export function TransferInfoCard() {
  const { theme } = useTheme();
  const buy = semanticStatusPalette(theme.colors, 'buy');
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
    <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[3.5], padding: theme.spacing[3.5], gap: theme.spacing[2] }}>
      <View style={[styles.header, { gap: theme.spacing[2.5], marginBottom: theme.spacing[1] }]}>
        <Ionicons name="swap-horizontal" size={theme.sizes.iconSm} color={hsl(theme.colors.brandPrimary)} />
        <View>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            Internal Transfer
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>Quick & Free</Text>
        </View>
      </View>
      {bullets.map((b) => (
        <View key={b} style={[styles.bullet, { gap: theme.spacing[2] }]}>
          <Ionicons name="checkmark-circle" size={theme.sizes.iconXs - 2} color={buy.fg} />
          <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary), flex: 1 }]}>{b}</Text>
        </View>
      ))}
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: hsl(theme.colors.foregroundSecondary),
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1.1,
            marginTop: theme.spacing[2],
          },
        ]}
      >
        Quick Links
      </Text>
      {links.map((l) => (
        <Pressable
          key={l.label}
          onPress={() => navigation.navigate(l.screen)}
          style={[styles.link, { paddingVertical: theme.spacing[2.5], minHeight: theme.listDensity.settings.rowHeight - 12 }]}
        >
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {l.label}
          </Text>
          <Ionicons name="chevron-forward" size={theme.sizes.iconXs - 2} color={hsl(theme.colors.brandPrimary)} />
        </Pressable>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start' },
  link: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
