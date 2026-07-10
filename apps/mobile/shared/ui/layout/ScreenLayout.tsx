import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@shared/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function ScreenLayout({ children, style, testID }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      testID={testID}
      style={[styles.root, { backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
});
