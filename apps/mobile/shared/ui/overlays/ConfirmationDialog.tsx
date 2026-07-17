import { Modal, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { useTheme, hsl } from '@shared/theme';
import { Button } from '../buttons/Button';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
  testID,
}: Props) {
  const { theme } = useTheme();
  const { duration } = theme.motion;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} testID={testID}>
      <Animated.View
        entering={FadeIn.duration(duration.dialogIn)}
        exiting={FadeOut.duration(duration.dialogOut)}
        style={[styles.overlay, { backgroundColor: hsl(theme.colors.overlayScrim), padding: theme.spacing[6] }]}
      >
        <Animated.View
          entering={ZoomIn.duration(duration.dialogZoom)}
          style={[
            styles.card,
            theme.shadows.md,
            {
              backgroundColor: hsl(theme.colors.backgroundElevated),
              borderRadius: theme.radius.xl,
              borderColor: hsl(theme.colors.borderDefault),
              padding: theme.spacing[5],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.headingMd,
              { color: hsl(theme.colors.foregroundPrimary), marginBottom: theme.spacing[2] },
            ]}
          >
            {title}
          </Text>
          {message ? (
            <Text
              style={[
                theme.typography.bodyMd,
                { color: hsl(theme.colors.foregroundSecondary), marginBottom: theme.spacing[5] },
              ]}
            >
              {message}
            </Text>
          ) : null}
          <View style={{ gap: theme.spacing[2] }}>
            <Button title={confirmLabel} onPress={onConfirm} variant={destructive ? 'destructive' : 'primary'} />
            <Button title={cancelLabel} onPress={onCancel} variant="ghost" />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { width: '100%', maxWidth: 360, borderWidth: 1 },
});
