import { TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  testID?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search markets', testID }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel="Search markets"
        style={[
          styles.input,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
            borderColor: `hsl(${theme.colors.borderDefault})`,
          },
        ]}
        placeholderTextColor={`hsl(${theme.colors.foregroundSecondary})`}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
});
