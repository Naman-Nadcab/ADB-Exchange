import { Modal, View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight, hsl } from '@shared/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
};

export function BottomSheet({ visible, onClose, title, children, testID }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { duration } = theme.motion;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <Animated.View
        entering={FadeIn.duration(duration.overlayIn)}
        exiting={FadeOut.duration(duration.overlayOut)}
        style={[styles.overlay, { backgroundColor: hsl(theme.colors.overlayScrim) }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <Animated.View
            entering={SlideInDown.duration(duration.sheetIn)}
            exiting={SlideOutDown.duration(duration.sheetOut)}
            style={[
              styles.sheet,
              theme.shadows.md,
              {
                backgroundColor: hsl(theme.colors.backgroundElevated),
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                paddingBottom: insets.bottom + theme.spacing[4],
              },
            ]}
          >
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: hsl(theme.colors.borderStrong),
                  marginTop: theme.spacing[2],
                  marginBottom: theme.spacing[1],
                },
              ]}
            />
            {title ? (
              <View
                style={[
                  styles.header,
                  {
                    borderBottomColor: hsl(theme.colors.borderDefault),
                    paddingHorizontal: theme.spacing[4],
                    paddingVertical: theme.spacing[3],
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.headingMd,
                    { color: hsl(theme.colors.foregroundPrimary), flex: 1 },
                  ]}
                >
                  {title}
                </Text>
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    onClose();
                  }}
                  hitSlop={theme.spacing[2]}
                >
                  <Ionicons name="close" size={theme.sizes.iconMd} color={hsl(theme.colors.foregroundSecondary)} />
                </Pressable>
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing[4] }}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
