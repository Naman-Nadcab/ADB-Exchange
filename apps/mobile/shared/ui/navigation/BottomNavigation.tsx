import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticSelection } from '@shared/theme';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Markets: 'bar-chart',
  Trade: 'trending-up',
  Orders: 'receipt',
  Wallet: 'wallet',
  P2P: 'people',
};

export function BottomNavigation({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const settingsDensity = theme.listDensity.settings;

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: insets.bottom,
          borderTopColor: `hsl(${theme.colors.borderDefault})`,
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor:
              Platform.OS === 'ios'
                ? `hsl(${theme.colors.backgroundElevated} / 0.92)`
                : `hsl(${theme.colors.backgroundElevated})`,
            paddingTop: theme.spacing[1.5],
            paddingHorizontal: theme.spacing[2],
            minHeight: theme.sizes.bottomNavHeight,
            gap: settingsDensity.gap,
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
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                void hapticSelection();
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ pressed }) => [
                styles.tab,
                {
                  opacity: pressed ? theme.opacity.pressed : 1,
                  backgroundColor: focused ? `hsl(${theme.colors.brandPrimary} / 0.12)` : 'transparent',
                  borderRadius: theme.radius.lg,
                  minHeight: settingsDensity.rowHeight,
                  paddingHorizontal: theme.spacing[0.5],
                },
              ]}
            >
              <Ionicons
                name={icon}
                size={focused ? theme.sizes.iconSm + 2 : theme.sizes.iconSm}
                color={focused ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`}
              />
              <Text
                style={[
                  theme.typography.labelSm,
                  {
                    marginTop: theme.spacing[0.5] + 1,
                    color: focused ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                    fontFamily: focused ? theme.fonts.sansSemiBold : theme.fonts.sansMedium,
                  },
                ]}
              >
                {label}
              </Text>
              {focused ? (
                <View
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: `hsl(${theme.colors.brandPrimary})`,
                      top: theme.spacing[0.5],
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    width: 20,
    height: 2,
  },
});
