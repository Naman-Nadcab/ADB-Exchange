import { TextInput, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  error?: string;
  testID?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  error,
  testID,
  autoCapitalize = 'none',
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            borderColor: error
              ? `hsl(${theme.colors.statusError})`
              : `hsl(${theme.colors.borderDefault})`,
            backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
          },
        ]}
        placeholderTextColor={`hsl(${theme.colors.foregroundSecondary})`}
      />
      {error ? (
        <Text style={[styles.error, { color: `hsl(${theme.colors.statusError})` }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  error: { fontSize: 12, marginTop: 4 },
});
