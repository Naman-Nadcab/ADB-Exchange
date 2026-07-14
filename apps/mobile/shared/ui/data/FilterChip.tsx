import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function FilterChip({ label, selected, onPress, testID }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void hapticSelection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radius.full,
          borderColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.45)` : `hsl(${theme.colors.borderDefault})`,
          backgroundColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.12)` : `hsl(${theme.colors.surfaceMuted} / 0.5)`,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[1.5],
        },
      ]}
    >
      <Text
        style={[
          theme.typography.labelMd,
          {
            color: selected ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: selected ? theme.fonts.sansSemiBold : theme.fonts.sansMedium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, minHeight: 32, justifyContent: 'center' },
});
