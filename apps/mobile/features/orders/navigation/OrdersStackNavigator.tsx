import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { guestGuard } from '@features/auth';
import { OrdersHomeScreen } from '../screens/OrdersHomeScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { TradeHistoryScreen } from '../screens/TradeHistoryScreen';
import type { OrdersStackParamList } from './types';
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen name="OrdersHome" component={OrdersHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OrderHistory" component={guestGuard(OrderHistoryScreen, 'Log in to view order history.')} options={{ title: 'Order History' }} />
      <Stack.Screen name="TradeHistory" component={guestGuard(TradeHistoryScreen, 'Log in to view trade history.')} options={{ title: 'Trade History' }} />
    </Stack.Navigator>
  );
}
