import { Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { BRAND_ASSETS, BRAND_LOGO_DIMENSIONS, type BrandLogoVariant } from './brandAssets';
import { BRAND_NAME_SHORT } from './brandCopy';

type Props = {
  variant?: BrandLogoVariant;
  onPress?: () => void;
  testID?: string;
};

export function BrandLogo({ variant = 'horizontal-gold', onPress, testID }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const useCompactHeader =
    variant === 'horizontal-gold' && windowWidth <= 640;

  const resolvedVariant: BrandLogoVariant = useCompactHeader
    ? 'horizontal-compact-gold'
    : variant;

  const src =
    resolvedVariant === 'marketing'
      ? BRAND_ASSETS.marketing
      : resolvedVariant === 'icon'
        ? BRAND_ASSETS.iconGold
        : resolvedVariant === 'horizontal-compact-gold'
          ? BRAND_ASSETS.horizontalCompactGold
          : BRAND_ASSETS.horizontalGold;
  const dims = BRAND_LOGO_DIMENSIONS[resolvedVariant];
  const aspect = dims.width / dims.height;
  const height = dims.displayHeight;
  const width = height * aspect;

  const img = (
    <Image
      testID={testID}
      source={src}
      style={{ width, height, resizeMode: 'contain' }}
      accessibilityLabel={BRAND_NAME_SHORT}
    />
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.wrap} accessibilityRole="button">
        {img}
      </Pressable>
    );
  }

  return <>{img}</>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
});
