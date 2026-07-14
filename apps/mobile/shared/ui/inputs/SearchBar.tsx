import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  testID?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search', testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          marginBottom: theme.spacing[3],
          borderRadius: theme.radius.md,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.inputBackground})`,
          paddingHorizontal: theme.spacing[3],
        },
      ]}
    >
      <Ionicons name="search" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        style={[
          styles.input,
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sans },
        ]}
        placeholderTextColor={`hsl(${theme.colors.foregroundSecondary})`}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  input: { flex: 1, paddingVertical: 10 },
});
