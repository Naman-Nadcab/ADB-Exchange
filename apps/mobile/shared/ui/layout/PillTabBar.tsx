import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  testID?: string;
};

/** Binance/frontend orders hub — frosted pill tabs inside a card */
export function PillTabBar({ tabs, active, onChange, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.track,
        {
          backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)`,
          borderRadius: theme.radius.lg,
          borderColor: `hsl(${theme.colors.borderDefault})`,
        },
      ]}
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
              styles.pill,
              {
                borderRadius: theme.radius.md,
                backgroundColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.14)` : 'transparent',
                borderColor: selected ? `hsl(${theme.colors.brandPrimary} / 0.22)` : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                theme.typography.labelMd,
                {
                  fontFamily: theme.fonts.sansSemiBold,
                  color: selected
                    ? `hsl(${theme.colors.brandPrimary})`
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
  track: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
});
