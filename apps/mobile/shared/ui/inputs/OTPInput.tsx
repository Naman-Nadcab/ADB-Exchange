import { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  testID?: string;
  error?: boolean;
};

export function OTPInput({ length = 6, value, onChange, testID, error }: Props) {
  const { theme } = useTheme();
  const ref = useRef<TextInput>(null);
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (value.length === length) void hapticSelection();
  }, [value, length]);

  return (
    <Pressable testID={testID} onPress={() => ref.current?.focus()} style={[styles.row, { gap: theme.spacing[2] }]}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={length}
        style={styles.hidden}
        caretHidden
      />
      {cells.map((digit, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            {
              borderRadius: theme.radius.md,
              borderColor: error
                ? `hsl(${theme.colors.statusError})`
                : i === value.length
                  ? `hsl(${theme.colors.ring})`
                  : `hsl(${theme.colors.borderDefault})`,
              backgroundColor: `hsl(${theme.colors.inputBackground})`,
            },
          ]}
        >
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{digit}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  cell: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
