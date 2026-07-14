import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MarketsStackNavigator } from '@features/markets';
import { TradeStackNavigator } from '@features/trade';
import { WalletStackNavigator } from '@features/wallet';
import { OrdersStackNavigator } from '@features/orders';
import { P2PStackNavigator } from '@features/p2p';
import { BottomNavigation } from '@shared/ui/navigation/BottomNavigation';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Markets" component={MarketsStackNavigator} />
      <Tab.Screen name="Trade" component={TradeStackNavigator} />
      <Tab.Screen name="Orders" component={OrdersStackNavigator} />
      <Tab.Screen name="Wallet" component={WalletStackNavigator} />
      <Tab.Screen name="P2P" component={P2PStackNavigator} />
    </Tab.Navigator>
  );
}
