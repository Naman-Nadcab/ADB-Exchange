import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Loader } from '@shared/ui';
import { useTheme, marketing } from '@shared/theme';

type Props = {
  testID: string;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
};

export function ShellStateScreen({
  testID,
  title,
  message,
  icon = 'information-circle-outline',
  actionLabel,
  onAction,
  loading,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          paddingTop: insets.top + theme.spacing[6],
          paddingBottom: insets.bottom + theme.spacing[6],
          paddingHorizontal: theme.spacing.pageX,
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: `hsl(${theme.colors.backgroundElevated})`, borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          {loading ? (
            <Loader size="lg" />
          ) : (
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `hsl(${theme.colors.surfaceMuted})`, marginBottom: theme.spacing[4] },
              ]}
            >
              <Ionicons name={icon} size={32} color={`hsl(${theme.colors.brandPrimary})`} />
            </View>
          )}
          <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})`, textAlign: 'center' }]}>
            {title}
          </Text>
          <Text
            style={[
              theme.typography.bodyMd,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                textAlign: 'center',
                marginTop: theme.spacing[2],
                maxWidth: 300,
              },
            ]}
          >
            {message}
          </Text>
          {actionLabel && onAction ? (
            <View style={{ width: '100%', marginTop: theme.spacing[6] }}>
              <PrimaryButton title={actionLabel} onPress={onAction} />
            </View>
          ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: marketing.pageBg,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
