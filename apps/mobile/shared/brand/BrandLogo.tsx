import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { BrandLogoVariant } from './brandAssets';
import { BRAND_NAME } from './brandCopy';

type Props = {
  variant?: BrandLogoVariant;
  onPress?: () => void;
  testID?: string;
};

/**
 * Typographic wordmark. Historical PNG artwork is not rendered.
 * Heights follow the previous mobile display heights for header (32) and icon (40).
 * Marketing uses a wordmark line (36) rather than the retired 120px raster frame.
 */
export function BrandLogo({ variant = 'horizontal-gold', onPress, testID }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const icon = variant === 'icon';
  const marketing = variant === 'marketing';
  const compactHeader = !icon && !marketing && windowWidth <= 640;
  const height = icon ? 40 : marketing ? 36 : 32;
  const fontSize = icon ? 13 : marketing ? 22 : compactHeader ? 16 : 18;

  const mark = (
    <View
      testID={testID}
      accessibilityLabel={BRAND_NAME}
      style={[styles.row, { height, minWidth: icon ? 40 : undefined }]}
    >
      <Text style={[styles.mark, { fontSize }]}>{icon ? 'ADB' : 'ADB'}</Text>
      {icon ? null : <Text style={[styles.name, { fontSize }]}>Exchange</Text>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.wrap} accessibilityRole="button">
        {mark}
      </Pressable>
    );
  }

  return mark;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  mark: { color: '#e8b923', fontWeight: '600' },
  name: { color: '#f5f7fa', fontWeight: '600' },
});
