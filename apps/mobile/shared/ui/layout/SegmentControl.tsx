import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Props = {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  testID?: string;
};

export function SegmentControl({ tabs, active, onChange, testID }: Props) {
  const { theme } = useTheme();
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: theme.spacing[3] }}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              void hapticSelection();
              onChange(tab.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                borderRadius: theme.radius.full,
                borderColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.35)` : `hsl(${theme.colors.borderDefault})`,
                backgroundColor: selected ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.surfaceMuted} / 0.55)`,
                paddingHorizontal: theme.spacing[3.5],
                minHeight: 36,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.labelMd,
                {
                  fontFamily: theme.fonts.sansSemiBold,
                  color: selected
                    ? `hsl(${theme.colors.brandPrimaryForeground})`
                    : `hsl(${theme.colors.foregroundPrimary})`,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, justifyContent: 'center', paddingVertical: 8 },
});
