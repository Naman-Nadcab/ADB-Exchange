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
      accessibilityRole="alert"
      accessibilityLabel={message}
      disabled={!onRetry}
      style={({ pressed }) => ({
        padding: theme.spacing[3],
        borderRadius: theme.radius.lg,
        marginBottom: theme.spacing[3],
        backgroundColor: `hsl(${theme.colors.statusError} / 0.12)`,
        borderWidth: theme.borderWidth.hairline,
        borderColor: `hsl(${theme.colors.statusError} / 0.28)`,
        opacity: onRetry && pressed ? theme.opacity.pressed : 1,
      })}
    >
      <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.statusError), fontFamily: theme.fonts.sansMedium }]}>
        {message}
      </Text>
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
