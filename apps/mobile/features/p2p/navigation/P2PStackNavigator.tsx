import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { guestGuard } from '@features/auth';
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
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<P2PStackParamList>();

export function P2PStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdDetail" component={AdDetailScreen} options={{ title: 'Ad' }} />
      <Stack.Screen name="MerchantProfile" component={MerchantProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="CreateOrder" component={guestGuard(CreateOrderScreen, 'Log in to buy or sell on P2P.')} options={{ title: 'Create Order' }} />
      <Stack.Screen name="PostAdType" component={guestGuard(PostAdTypeScreen, 'Log in to post a P2P ad.')} options={{ title: 'Post Ad' }} />
      <Stack.Screen name="PostAdPrice" component={guestGuard(PostAdPriceScreen, 'Log in to post a P2P ad.')} options={{ title: 'Price & Limits' }} />
      <Stack.Screen name="PostAdPayment" component={guestGuard(PostAdPaymentScreen, 'Log in to post a P2P ad.')} options={{ title: 'Payment Methods' }} />
      <Stack.Screen name="PostAdReview" component={guestGuard(PostAdReviewScreen, 'Log in to post a P2P ad.')} options={{ title: 'Review' }} />
      <Stack.Screen name="MyAds" component={guestGuard(MyAdsScreen, 'Log in to manage your ads.')} options={{ title: 'My Ads' }} />
      <Stack.Screen name="EditAd" component={guestGuard(EditAdScreen, 'Log in to edit ads.')} options={{ title: 'Edit Ad' }} />
      <Stack.Screen name="OrdersList" component={guestGuard(OrdersListScreen, 'Log in to view P2P orders.')} options={{ title: 'P2P Orders' }} />
      <Stack.Screen name="OrderRoom" component={guestGuard(OrderRoomScreen, 'Log in to access P2P order chat.')} options={{ title: 'Order' }} />
      <Stack.Screen name="PaymentMethods" component={guestGuard(PaymentMethodsScreen, 'Log in to manage payment methods.')} options={{ title: 'Payment Methods' }} />
      <Stack.Screen name="AddPaymentMethod" component={guestGuard(AddPaymentMethodScreen, 'Log in to add payment methods.')} options={{ title: 'Payment Method' }} />
      <Stack.Screen name="MerchantDashboard" component={guestGuard(MerchantDashboardScreen, 'Log in to access merchant dashboard.')} options={{ title: 'Merchant' }} />
      <Stack.Screen name="DisputeDetail" component={guestGuard(DisputeDetailScreen, 'Log in to view disputes.')} options={{ title: 'Dispute' }} />
      <Stack.Screen name="BlockedAdvertisers" component={guestGuard(BlockedAdvertisersScreen, 'Log in to manage blocked advertisers.')} options={{ title: 'Blocked' }} />
    </Stack.Navigator>
  );
}
