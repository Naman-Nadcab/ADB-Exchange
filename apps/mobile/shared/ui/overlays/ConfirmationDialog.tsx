import { Modal, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@shared/theme';
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} testID={testID}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.overlay}>
        <Animated.View
          entering={ZoomIn.duration(220)}
          style={[
            styles.card,
            theme.shadows.md,
            {
              backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
              borderRadius: theme.radius.xl,
              borderColor: `hsl(${theme.colors.borderDefault})`,
              padding: theme.spacing[5],
            },
          ]}
        >
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[2] }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[5] }]}>
              {message}
            </Text>
          ) : null}
          <View style={{ gap: theme.spacing[2] }}>
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'destructive' : 'primary'}
            />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 360, borderWidth: 1 },
});
