import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@shared/brand';
import { Loader } from '@shared/ui';
import { useTheme } from '@shared/theme';

/** Boot splash — matches website marketing brand (#05070B + gold). */
export function SplashScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="S-000"
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: theme.marketing.pageBg,
          gap: theme.spacing.pageY,
          paddingHorizontal: theme.spacing[8],
        },
      ]}
    >
      <BrandLogo variant="marketing" />
      <Loader size="lg" />
      <Text style={[theme.typography.bodyMd, { color: theme.marketing.mutedText, textAlign: 'center' }]}>
        Loading your trading experience…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
