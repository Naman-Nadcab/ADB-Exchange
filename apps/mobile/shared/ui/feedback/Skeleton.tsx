import { useEffect } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@shared/theme';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Skeleton({ width = '100%', height = 16, style, testID }: Props) {
  const { theme } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: theme.motion.duration.skeletonPulse }), -1, true);
  }, [pulse, theme.motion.duration.skeletonPulse]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [theme.opacity.skeletonMin, theme.opacity.skeletonMax]),
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          width,
          height,
          borderRadius: theme.radius.sm,
          backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
        },
        anim,
        style,
      ]}
    />
  );
}

export function SkeletonGroup({ count = 3 }: { count?: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={theme.listDensity.settings.rowHeight} />
      ))}
    </View>
  );
}
