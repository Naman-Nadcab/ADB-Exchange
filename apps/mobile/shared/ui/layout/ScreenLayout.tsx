import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@shared/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  scroll?: boolean;
  keyboard?: boolean;
  edges?: Edge[];
  padded?: boolean;
};

export function ScreenLayout({
  children,
  style,
  contentStyle,
  testID,
  scroll = false,
  keyboard = true,
  edges = ['top', 'left', 'right'],
  padded = true,
}: Props) {
  const { theme } = useTheme();
  const pad = padded ? theme.spacing.pageX : 0;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pad }, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { paddingHorizontal: pad }, contentStyle]}>{children}</View>
  );

  const wrapped =
    keyboard && Platform.OS === 'ios' ? (
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {body}
      </KeyboardAvoidingView>
    ) : (
      body
    );

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.root, { backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }, style]}
    >
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingTop: 8 },
  scrollContent: { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },
});
