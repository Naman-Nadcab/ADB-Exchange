import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';
import { ChangeLabel } from './ChangeLabel';
import { PriceLabel } from './PriceLabel';

type Props = {
  symbol: string;
  name?: string;
  balance?: string;
  value?: number;
  changePct?: number;
  onPress?: () => void;
  right?: React.ReactNode;
  testID?: string;
};

export function AssetRow({ symbol, name, balance, value, changePct, onPress, right, testID }: Props) {
  const { theme } = useTheme();
  const density = theme.listDensity.asset;
  const content = (
    <View
      style={[
        styles.row,
        {
          paddingVertical: theme.spacing[3],
          minHeight: density.rowHeight,
          borderBottomColor: `hsl(${theme.colors.borderDefault})`,
        },
      ]}
    >
      <View style={styles.left}>
        <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansSemiBold, color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {symbol}
        </Text>
        {name ? (
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{name}</Text>
        ) : null}
      </View>
      <View style={[styles.right, { gap: theme.spacing[0.5] }]}>
        {value != null ? <PriceLabel value={value} size="md" /> : null}
        {balance ? (
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'right' }]}>
            {balance}
          </Text>
        ) : null}
        {changePct != null ? <ChangeLabel changePct={changePct} /> : null}
        {right}
      </View>
    </View>
  );

  if (!onPress) return <View testID={testID}>{content}</View>;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? theme.opacity.pressed : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
});
