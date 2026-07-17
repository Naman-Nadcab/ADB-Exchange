import { Text, Pressable } from 'react-native';
import { useTheme, hsl } from '@shared/theme';

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, onRetry }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onRetry}
      style={{
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        marginBottom: theme.spacing[3],
        backgroundColor: `hsl(${theme.colors.statusError} / 0.12)`,
      }}
    >
      <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.statusError) }]}>{message}</Text>
      {onRetry ? (
        <Text
          style={[
            theme.typography.bodySm,
            {
              color: hsl(theme.colors.statusError),
              marginTop: theme.spacing[1],
              fontFamily: theme.fonts.sansSemiBold,
            },
          ]}
        >
          Tap to retry
        </Text>
      ) : null}
    </Pressable>
  );
}
