import { Image, Pressable, StyleSheet } from 'react-native';
import { BRAND_ASSETS, BRAND_LOGO_DIMENSIONS, type BrandLogoVariant } from './brandAssets';

type Props = {
  variant?: BrandLogoVariant;
  onPress?: () => void;
  testID?: string;
};

export function BrandLogo({ variant = 'horizontal-gold', onPress, testID }: Props) {
  const src =
    variant === 'marketing'
      ? BRAND_ASSETS.marketing
      : variant === 'icon'
        ? BRAND_ASSETS.iconGold
        : BRAND_ASSETS.horizontalGold;
  const dims = BRAND_LOGO_DIMENSIONS[variant];
  const aspect = dims.width / dims.height;
  const height = dims.displayHeight;
  const width = height * aspect;

  const img = (
    <Image
      testID={testID}
      source={src}
      style={{ width, height, resizeMode: 'contain' }}
      accessibilityLabel="Metherium"
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
