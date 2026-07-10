import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrdersHomeScreen } from '../screens/OrdersHomeScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { TradeHistoryScreen } from '../screens/TradeHistoryScreen';
import type { OrdersStackParamList } from './types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="OrdersHome" component={OrdersHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: 'Order History' }} />
      <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} options={{ title: 'Trade History' }} />
    </Stack.Navigator>
  );
}
