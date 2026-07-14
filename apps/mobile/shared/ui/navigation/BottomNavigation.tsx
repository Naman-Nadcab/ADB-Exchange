import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticSelection } from '@shared/theme';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Markets: 'stats-chart',
  Trade: 'trending-up',
  Orders: 'list',
  Wallet: 'wallet',
  P2P: 'people',
};

export function BottomNavigation({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        theme.shadows.md,
        {
          paddingBottom: insets.bottom + 4,
          backgroundColor: `hsl(${theme.colors.backgroundElevated} / 0.95)`,
          borderTopColor: `hsl(${theme.colors.borderDefault})`,
          minHeight: theme.sizes.bottomNavHeight + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const icon = TAB_ICONS[route.name] ?? 'ellipse';

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              void hapticSelection();
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ pressed }) => [
              styles.tab,
              {
                opacity: pressed ? 0.85 : 1,
                backgroundColor: focused ? `hsl(${theme.colors.brandPrimary} / 0.1)` : 'transparent',
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={20}
              color={focused ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
            />
            <Text
              style={[
                theme.typography.labelSm,
                {
                  marginTop: 2,
                  color: focused ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: focused ? theme.fonts.sansSemiBold : theme.fonts.sansMedium,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
