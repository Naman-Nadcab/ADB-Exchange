import { useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@shared/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  testID?: string;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  testID,
  autoCapitalize = 'none',
  ...rest
}: Props) {
  const { theme } = useTheme();
  const focused = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor:
      error != null && error.length > 0
        ? `hsl(${theme.colors.statusError})`
        : focused.value
          ? `hsl(${theme.colors.ring})`
          : `hsl(${theme.colors.borderDefault})`,
  }));

  return (
    <View style={{ marginBottom: theme.spacing[4] }}>
      {label ? (
        <Text
          accessibilityRole="text"
          style={[
            theme.typography.labelMd,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansMedium,
              marginBottom: theme.spacing[1.5],
              letterSpacing: 0.2,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.inputRow,
          {
            minHeight: theme.sizes.inputHeight,
            borderRadius: theme.radius.lg,
            backgroundColor: `hsl(${theme.colors.backgroundElevated} / 0.55)`,
            borderWidth: 1,
          },
          ringStyle,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={theme.sizes.iconSm}
            color={`hsl(${theme.colors.foregroundSecondary})`}
            style={{ marginLeft: theme.spacing[4] }}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          testID={testID}
          accessibilityLabel={label ?? placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => {
            focused.value = withTiming(1, { duration: theme.motion.duration.fast });
          }}
          onBlur={() => {
            focused.value = withTiming(0, { duration: theme.motion.duration.fast });
          }}
          style={[
            styles.input,
            theme.typography.bodyLg,
            {
              color: `hsl(${theme.colors.foregroundPrimary})`,
              fontFamily: theme.fonts.sans,
              paddingHorizontal: leftIcon ? theme.spacing[2] : theme.spacing[4],
              paddingVertical: theme.spacing[3.5],
            },
          ]}
          placeholderTextColor={`hsl(${theme.colors.foregroundSecondary})`}
          {...rest}
        />
        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={theme.spacing[2]}
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingRight: theme.spacing[4],
              opacity: pressed ? theme.opacity.pressed : 1,
            })}
          >
            <Ionicons name={rightIcon} size={theme.sizes.iconSm} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text
          style={[
            theme.typography.bodySm,
            {
              color: `hsl(${theme.colors.statusError})`,
              marginTop: theme.spacing[1],
              backgroundColor: `hsl(${theme.colors.statusError} / 0.1)`,
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[1.5],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1 },
});
