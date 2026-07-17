import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  transparent?: boolean;
  testID?: string;
};

export function TopAppBar({
  title,
  subtitle,
  onBack,
  onAction,
  actionIcon = 'ellipsis-horizontal',
  right,
  transparent,
  testID,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          paddingTop: insets.top > 0 ? 0 : theme.spacing[2],
          minHeight: theme.sizes.topBarHeight + (insets.top > 0 ? 0 : theme.spacing[2]),
          paddingHorizontal: theme.spacing[1],
          backgroundColor: transparent ? 'transparent' : `hsl(${theme.colors.backgroundPrimary} / 0.92)`,
          borderBottomColor: transparent ? 'transparent' : `hsl(${theme.colors.borderDefault})`,
        },
      ]}
    >
      <View style={[styles.side, { width: theme.sizes.tapTarget + theme.spacing[1] }]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              void hapticLight();
              onBack();
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                width: theme.sizes.tapTarget,
                height: theme.sizes.tapTarget,
                opacity: pressed ? theme.opacity.pressed : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundPrimary})`} />
          </Pressable>
        ) : (
          <View style={[styles.iconBtn, { width: theme.sizes.tapTarget, height: theme.sizes.tapTarget }]} />
        )}
      </View>
      <View style={[styles.center, { paddingHorizontal: theme.spacing[2] }]}>
        {title ? (
          <Text
            numberOfLines={1}
            style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})`, textAlign: 'center' }]}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right, { width: theme.sizes.tapTarget + theme.spacing[1] }]}>
        {right ??
          (onAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void hapticLight();
                onAction();
              }}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  width: theme.sizes.tapTarget,
                  height: theme.sizes.tapTarget,
                  opacity: pressed ? theme.opacity.pressed : 1,
                },
              ]}
            >
              <Ionicons name={actionIcon} size={theme.sizes.iconSm + 2} color={`hsl(${theme.colors.foregroundPrimary})`} />
            </Pressable>
          ) : (
            <View style={[styles.iconBtn, { width: theme.sizes.tapTarget, height: theme.sizes.tapTarget }]} />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { alignItems: 'flex-start', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
