import { useEffect, useRef } from 'react';
import { Text, type TextProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@shared/theme';

type Props = TextProps & {
  value: string;
  direction?: 'up' | 'down' | 'neutral';
  size?: 'md' | 'lg' | 'xl';
};

const AnimatedText = Animated.createAnimatedComponent(Text);

export function PriceFlashText({ value, direction = 'neutral', size = 'lg', style, ...rest }: Props) {
  const { theme } = useTheme();
  const flash = useSharedValue(0);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value && direction !== 'neutral') {
      flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 400 }));
    }
    prev.current = value;
  }, [value, direction, flash]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - flash.value * 0.15,
    transform: [{ scale: 1 + flash.value * 0.02 }],
  }));

  const fontSize = size === 'xl' ? 28 : size === 'lg' ? 22 : 16;
  const color =
    direction === 'up'
      ? theme.colors.tradeBuy
      : direction === 'down'
        ? theme.colors.tradeSell
        : theme.colors.foregroundPrimary;

  return (
    <AnimatedText
      {...rest}
      style={[
        animatedStyle,
        {
          fontSize,
          fontWeight: '700',
          fontFamily: theme.fonts.monoSemiBold,
          fontVariant: ['tabular-nums'],
          color: `hsl(${color})`,
        },
        style,
      ]}
    >
      {value}
    </AnimatedText>
  );
}
