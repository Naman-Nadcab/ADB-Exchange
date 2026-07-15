import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SpotTradingScreen } from '../screens/SpotTradingScreen';
import { PairSelectorScreen } from '../screens/PairSelectorScreen';
import { ChartFullscreenScreen } from '../screens/ChartFullscreenScreen';
import { OrderbookFullscreenScreen } from '../screens/OrderbookFullscreenScreen';
import { TradesFullscreenScreen } from '../screens/TradesFullscreenScreen';
import type { TradeStackParamList } from './types';
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<TradeStackParamList>();

export function TradeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen
        name="SpotTrading"
        component={SpotTradingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="PairSelector" component={PairSelectorScreen} options={{ title: 'Select pair' }} />
      <Stack.Screen name="ChartFullscreen" component={ChartFullscreenScreen} options={{ title: 'Chart' }} />
      <Stack.Screen name="OrderbookFullscreen" component={OrderbookFullscreenScreen} options={{ title: 'Order book' }} />
      <Stack.Screen name="TradesFullscreen" component={TradesFullscreenScreen} options={{ title: 'Trades' }} />
    </Stack.Navigator>
  );
}
