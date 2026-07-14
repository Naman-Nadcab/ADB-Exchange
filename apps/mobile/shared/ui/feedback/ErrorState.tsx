import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { Button } from '../buttons/Button';

type Props = {
  title: string;
  message?: string;
  onRetry?: () => void;
  testID?: string;
};

export function ErrorState({ title, message, onRetry, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          padding: theme.spacing[6],
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.statusError} / 0.35)`,
          backgroundColor: `hsl(${theme.colors.statusError} / 0.08)`,
        },
      ]}
    >
      <Ionicons name="alert-circle-outline" size={32} color={`hsl(${theme.colors.statusError})`} />
      <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansSemiBold, color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: theme.spacing[3], textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1], textAlign: 'center' }]}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button title="Try again" onPress={onRetry} variant="outline" size="md" fullWidth={false} style={{ marginTop: theme.spacing[4], paddingHorizontal: 20 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
