import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@shared/brand';
import { Loader } from '@shared/ui';
import { marketing } from '@shared/theme';

/** Boot splash — matches website marketing brand (#05070B + gold). */
export function SplashScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="S-000"
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <BrandLogo variant="marketing" />
      <Loader size="lg" />
      <Text style={styles.message}>Loading your trading experience…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: marketing.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  message: {
    color: marketing.mutedText,
    fontSize: 14,
    textAlign: 'center',
  },
});
