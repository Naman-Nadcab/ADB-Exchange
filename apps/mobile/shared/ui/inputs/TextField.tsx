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
  label: string;
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
          ? `hsl(${theme.colors.ring} / 0.55)`
          : `hsl(${theme.colors.borderDefault})`,
  }));

  return (
    <View style={[styles.wrap, { marginBottom: theme.spacing[4] }]}>
      <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[1.5] }]}>
        {label}
      </Text>
      <Animated.View
        style={[
          styles.inputRow,
          {
            minHeight: theme.sizes.inputHeight,
            borderRadius: theme.radius.md,
            backgroundColor: `hsl(${theme.colors.inputBackground})`,
            borderWidth: 1,
          },
          ringStyle,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={`hsl(${theme.colors.foregroundSecondary})`}
            style={{ marginLeft: theme.spacing[3] }}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          testID={testID}
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
              paddingHorizontal: leftIcon ? theme.spacing[2] : theme.spacing[3],
            },
          ]}
          placeholderTextColor={`hsl(${theme.colors.foregroundSecondary})`}
          {...rest}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8} style={{ paddingRight: theme.spacing[3] }}>
            <Ionicons name={rightIcon} size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.statusError})`, marginTop: theme.spacing[1] }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12 },
});
