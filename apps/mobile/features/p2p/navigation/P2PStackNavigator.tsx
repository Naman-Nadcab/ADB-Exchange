import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { AdDetailScreen } from '../screens/AdDetailScreen';
import { CreateOrderScreen } from '../screens/CreateOrderScreen';
import { PostAdTypeScreen } from '../screens/PostAdTypeScreen';
import { PostAdPriceScreen } from '../screens/PostAdPriceScreen';
import { PostAdPaymentScreen } from '../screens/PostAdPaymentScreen';
import { PostAdReviewScreen } from '../screens/PostAdReviewScreen';
import { MyAdsScreen } from '../screens/MyAdsScreen';
import { EditAdScreen } from '../screens/EditAdScreen';
import { OrdersListScreen } from '../screens/OrdersListScreen';
import { OrderRoomScreen } from '../screens/OrderRoomScreen';
import { PaymentMethodsScreen } from '../screens/PaymentMethodsScreen';
import { AddPaymentMethodScreen } from '../screens/AddPaymentMethodScreen';
import { MerchantDashboardScreen } from '../screens/MerchantDashboardScreen';
import { MerchantProfileScreen } from '../screens/MerchantProfileScreen';
import { DisputeDetailScreen } from '../screens/DisputeDetailScreen';
import { BlockedAdvertisersScreen } from '../screens/BlockedAdvertisersScreen';
import type { P2PStackParamList } from './types';

const Stack = createNativeStackNavigator<P2PStackParamList>();

export function P2PStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'P2P' }} />
      <Stack.Screen name="AdDetail" component={AdDetailScreen} options={{ title: 'Ad' }} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ title: 'Create Order' }} />
      <Stack.Screen name="PostAdType" component={PostAdTypeScreen} options={{ title: 'Post Ad' }} />
      <Stack.Screen name="PostAdPrice" component={PostAdPriceScreen} options={{ title: 'Price & Limits' }} />
      <Stack.Screen name="PostAdPayment" component={PostAdPaymentScreen} options={{ title: 'Payment Methods' }} />
      <Stack.Screen name="PostAdReview" component={PostAdReviewScreen} options={{ title: 'Review' }} />
      <Stack.Screen name="MyAds" component={MyAdsScreen} options={{ title: 'My Ads' }} />
      <Stack.Screen name="EditAd" component={EditAdScreen} options={{ title: 'Edit Ad' }} />
      <Stack.Screen name="OrdersList" component={OrdersListScreen} options={{ title: 'P2P Orders' }} />
      <Stack.Screen name="OrderRoom" component={OrderRoomScreen} options={{ title: 'Order' }} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: 'Payment Methods' }} />
      <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} options={{ title: 'Payment Method' }} />
      <Stack.Screen name="MerchantDashboard" component={MerchantDashboardScreen} options={{ title: 'Merchant' }} />
      <Stack.Screen name="MerchantProfile" component={MerchantProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} options={{ title: 'Dispute' }} />
      <Stack.Screen name="BlockedAdvertisers" component={BlockedAdvertisersScreen} options={{ title: 'Blocked' }} />
    </Stack.Navigator>
  );
}
