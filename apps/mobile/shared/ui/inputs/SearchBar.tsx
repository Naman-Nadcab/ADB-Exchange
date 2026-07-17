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
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.inputBackground})`,
          paddingHorizontal: theme.spacing[3],
          minHeight: theme.sizes.tapTarget,
          gap: theme.spacing[2],
        },
      ]}
    >
      <Ionicons name="search" size={theme.sizes.iconSm} color={`hsl(${theme.colors.foregroundSecondary})`} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        style={[
          styles.input,
          theme.typography.bodyMd,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sans,
            paddingVertical: theme.spacing[2.5],
          },
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
    borderWidth: 1,
  },
  input: { flex: 1 },
});
