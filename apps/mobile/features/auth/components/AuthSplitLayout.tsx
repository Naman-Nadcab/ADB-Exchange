import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticSelection } from '@shared/theme';
import { BrandLogo } from '@shared/brand';

type Props = {
  children: React.ReactNode;
  testID?: string;
  showMarketingLogo?: boolean;
  onBack?: () => void;
};

/** Mobile adaptation of apps/frontend AuthSplitLayout (form panel). */
export function AuthSplitLayout({ children, testID, showMarketingLogo, onBack }: Props) {
  const { theme, colorScheme, setColorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const panelBg =
    colorScheme === 'dark'
      ? `hsl(${theme.colors.backgroundPrimary})`
      : `hsl(${theme.colors.backgroundElevated})`;

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: panelBg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={[styles.header, { paddingHorizontal: theme.spacing[5] }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={`hsl(${theme.colors.foregroundPrimary})`} />
          </Pressable>
        ) : (
          <BrandLogo variant="horizontal-gold" />
        )}
        <Pressable
          onPress={() => {
            void hapticSelection();
            setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
          }}
          style={styles.themeBtn}
          accessibilityRole="button"
          accessibilityLabel="Toggle theme"
        >
          <Ionicons
            name={colorScheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={20}
            color={`hsl(${theme.colors.foregroundSecondary})`}
          />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: theme.spacing[5] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formWrap}>
            {showMarketingLogo ? (
              <View style={[styles.marketingLogo, { marginBottom: theme.spacing[8] }]}>
                <BrandLogo variant="marketing" />
              </View>
            ) : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            textAlign: 'center',
            paddingBottom: theme.spacing[3],
          },
        ]}
      >
        © 2018–2026 Metherium
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  themeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formWrap: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  marketingLogo: { alignItems: 'center' },
});
