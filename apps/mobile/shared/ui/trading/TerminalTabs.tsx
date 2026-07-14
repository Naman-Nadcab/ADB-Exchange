import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  testID?: string;
};

/** Mobile adaptation of frontend `.terminal-tab` — top-border active indicator */
export function TerminalTabs({ tabs, active, onChange, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.row, { borderBottomColor: `hsl(${theme.colors.borderDefault})`, marginBottom: theme.spacing[3] }]}
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
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.tab,
              {
                borderTopColor: selected ? `hsl(${theme.colors.brandPrimary})` : 'transparent',
                borderTopWidth: selected ? 2 : 0,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.labelMd,
                {
                  fontFamily: theme.fonts.sansSemiBold,
                  color: selected
                    ? `hsl(${theme.colors.foregroundPrimary})`
                    : `hsl(${theme.colors.foregroundSecondary})`,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 40 },
});
