import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { Button } from '../buttons/Button';

type Props = {
  title: string;
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
};

export function EmptyState({
  title,
  message,
  onAction,
  actionLabel,
  icon = 'file-tray-outline',
  testID,
}: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          padding: theme.spacing[6],
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
        },
      ]}
      accessibilityRole="text"
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
            marginBottom: theme.spacing[4],
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </View>
      <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansSemiBold, color: `hsl(${theme.colors.foregroundPrimary})`, textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center', marginTop: theme.spacing[1], marginBottom: theme.spacing[4], maxWidth: 280 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {onAction && actionLabel ? (
        <Button title={actionLabel} onPress={onAction} size="md" fullWidth={false} style={{ paddingHorizontal: 24 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
