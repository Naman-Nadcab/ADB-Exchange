import { DarkTheme, type Theme } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { marketing } from '@shared/theme/marketing';

/** Global React Navigation theme — matches production website dark palette. */
export const exchangeNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: marketing.gold,
    background: marketing.pageBg,
    card: marketing.cardBg,
    text: '#F5F5F5',
    border: 'rgba(255, 255, 255, 0.08)',
    notification: marketing.gold,
  },
};

/** Default native-stack options for every feature stack. */
export const exchangeStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: marketing.cardBg },
  headerTintColor: '#F5F5F5',
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerShadowVisible: false,
  headerBackVisible: true,
  contentStyle: { backgroundColor: marketing.pageBg },
  animation: 'slide_from_right',
};
