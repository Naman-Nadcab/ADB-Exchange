import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketsHomeScreen } from '../screens/MarketsHomeScreen';
import { MarketSearchScreen } from '../screens/MarketSearchScreen';
import { PairDetailScreen } from '../screens/PairDetailScreen';
import type { MarketsStackParamList } from './types';
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<MarketsStackParamList>();

export function MarketsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen name="MarketsHome" component={MarketsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MarketSearch" component={MarketSearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen
        name="PairDetail"
        component={PairDetailScreen}
        options={({ route }) => ({ title: route.params.symbol })}
      />
    </Stack.Navigator>
  );
}
