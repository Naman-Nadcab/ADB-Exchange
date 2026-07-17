import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { StateFrame } from '@shared/components/StateFrame';
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
    <StateFrame variant="empty" testID={testID}>
      <View
        style={[
          styles.iconWrap,
          {
            width: theme.sizes.avatarLg,
            height: theme.sizes.avatarLg,
            borderRadius: theme.sizes.avatarLg / 2,
            backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
            marginBottom: theme.spacing[4],
          },
        ]}
      >
        <Ionicons name={icon} size={theme.sizes.iconLg} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </View>
      <Text
        style={[
          theme.typography.bodyMd,
          {
            fontFamily: theme.fonts.sansSemiBold,
            color: `hsl(${theme.colors.foregroundPrimary})`,
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
              textAlign: 'center',
              marginTop: theme.spacing[1],
              marginBottom: theme.spacing[4],
              maxWidth: 280,
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {onAction && actionLabel ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          size="md"
          fullWidth={false}
          style={{ paddingHorizontal: theme.spacing[6] }}
        />
      ) : null}
    </StateFrame>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
