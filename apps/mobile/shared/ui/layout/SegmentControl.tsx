import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
};

export function SegmentControl({ tabs, active, onChange }: Props) {
  const { theme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                backgroundColor: selected
                  ? `hsl(${theme.colors.brandPrimary})`
                  : `hsl(${theme.colors.surfaceMuted})`,
              },
            ]}
          >
            <Text
              style={{
                color: selected
                  ? `hsl(${theme.colors.brandPrimaryForeground})`
                  : `hsl(${theme.colors.foregroundPrimary})`,
                fontWeight: '600',
                fontSize: 13,
              }}
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
  row: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
});
