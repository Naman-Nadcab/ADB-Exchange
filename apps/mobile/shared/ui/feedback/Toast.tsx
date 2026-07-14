import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { useToastStore, type ToastTone } from './toastStore';

function toneColor(tone: ToastTone, colors: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (tone) {
    case 'success':
      return colors.statusSuccess;
    case 'error':
      return colors.statusError;
    case 'warning':
      return colors.statusWarning;
    default:
      return colors.foregroundPrimary;
  }
}

function toneIcon(tone: ToastTone): keyof typeof Ionicons.glyphMap {
  switch (tone) {
    case 'success':
      return 'checkmark-circle';
    case 'error':
      return 'close-circle';
    case 'warning':
      return 'warning';
    default:
      return 'information-circle';
  }
}

export function ToastHost() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queue = useToastStore((s) => s.queue);
  const dismiss = useToastStore((s) => s.dismiss);
  const item = queue[0];

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item, dismiss]);

  if (!item) return null;

  const accent = toneColor(item.tone, theme.colors);

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View
        entering={FadeInUp.duration(theme.motion.duration.normal)}
        exiting={FadeOutUp.duration(theme.motion.duration.fast)}
        style={[
          styles.toast,
          theme.shadows.md,
          {
            backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
            borderColor: `hsl(${theme.colors.borderDefault})`,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Pressable style={styles.row} onPress={() => dismiss(item.id)}>
          <Ionicons name={toneIcon(item.tone)} size={20} color={`hsl(${accent})`} />
          <View style={styles.textCol}>
            <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansSemiBold, color: `hsl(${theme.colors.foregroundPrimary})` }]}>
              {item.title}
            </Text>
            {item.message ? (
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }]}>
                {item.message}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, zIndex: 9999 },
  toast: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  textCol: { flex: 1 },
});

export { showToast, showSnackbar } from './toastStore';
