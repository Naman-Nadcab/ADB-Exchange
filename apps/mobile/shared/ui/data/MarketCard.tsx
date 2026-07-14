import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { ChangeLabel } from './ChangeLabel';
import { PriceLabel } from './PriceLabel';

type Props = {
  base: string;
  quote: string;
  price: number;
  changePct: number;
  volume?: string;
  onPress?: () => void;
  testID?: string;
};

export function MarketCard({ base, quote, price, changePct, volume, onPress, testID }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void hapticLight();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.card,
        theme.shadows.sm,
        {
          opacity: pressed ? 0.92 : 1,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          borderRadius: theme.radius.lg,
          padding: theme.spacing[4],
        },
      ]}
    >
      <View style={styles.row}>
        <View>
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {base}
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 14 }}>/{quote}</Text>
          </Text>
          {volume ? (
            <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
              Vol {volume}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <PriceLabel value={price} size="md" />
          <ChangeLabel changePct={changePct} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
});
