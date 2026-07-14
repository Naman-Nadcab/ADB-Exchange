import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, Card, PrimaryButton, Loader } from '@shared/ui';
import { useTheme } from '@shared/theme';

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

  return (
    <ScreenLayout testID={testID} padded={false}>
      <View style={[styles.wrap, { padding: theme.spacing.pageX }]}>
        <Card elevated style={{ alignItems: 'center', paddingVertical: theme.spacing[8] }}>
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
        </Card>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
