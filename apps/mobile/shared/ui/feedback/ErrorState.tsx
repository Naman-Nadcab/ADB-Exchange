import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { StateFrame } from '@shared/components/StateFrame';
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
    <StateFrame variant="error" testID={testID}>
      <Ionicons name="alert-circle-outline" size={theme.sizes.iconLg} color={`hsl(${theme.colors.statusError})`} />
      <Text
        style={[
          theme.typography.bodyMd,
          {
            fontFamily: theme.fonts.sansSemiBold,
            color: `hsl(${theme.colors.foregroundPrimary})`,
            marginTop: theme.spacing[3],
            textAlign: 'center',
          },
        ]}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            theme.typography.bodySm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              marginTop: theme.spacing[1],
              textAlign: 'center',
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          title="Try again"
          onPress={onRetry}
          variant="outline"
          size="md"
          fullWidth={false}
          style={{ marginTop: theme.spacing[4], paddingHorizontal: theme.spacing[5] }}
        />
      ) : null}
    </StateFrame>
  );
}
