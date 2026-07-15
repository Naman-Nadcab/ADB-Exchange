import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { guestGuard } from '@features/auth';
import { AssetsHomeScreen } from '../screens/AssetsHomeScreen';
import { AssetDetailScreen } from '../screens/AssetDetailScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { TransferHistoryScreen } from '../screens/TransferHistoryScreen';
import { ConvertScreen } from '../screens/ConvertScreen';
import { ConvertHistoryScreen } from '../screens/ConvertHistoryScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
import { FundHistoryScreen } from '../screens/FundHistoryScreen';
import { DepositHomeScreen } from '../screens/DepositHomeScreen';
import { DepositNetworkScreen } from '../screens/DepositNetworkScreen';
import { DepositAddressScreen } from '../screens/DepositAddressScreen';
import { DepositHistoryScreen } from '../screens/DepositHistoryScreen';
import { DepositDetailScreen } from '../screens/DepositDetailScreen';
import { WithdrawHomeScreen } from '../screens/WithdrawHomeScreen';
import { WithdrawFormScreen } from '../screens/WithdrawFormScreen';
import { WithdrawConfirmScreen } from '../screens/WithdrawConfirmScreen';
import { WithdrawalHistoryScreen } from '../screens/WithdrawalHistoryScreen';
import { WithdrawalDetailScreen } from '../screens/WithdrawalDetailScreen';
import { AddressBookScreen } from '../screens/AddressBookScreen';
import { AddAddressScreen } from '../screens/AddAddressScreen';
import { EditAddressScreen } from '../screens/EditAddressScreen';
import type { WalletStackParamList } from './types';
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<WalletStackParamList>();

export function WalletStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen name="AssetsHome" component={AssetsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AssetDetail" component={guestGuard(AssetDetailScreen, 'Log in to view asset details.')} options={{ title: 'Asset' }} />
      <Stack.Screen name="Transfer" component={guestGuard(TransferScreen, 'Log in to transfer funds.')} options={{ title: 'Transfer' }} />
      <Stack.Screen name="TransferHistory" component={guestGuard(TransferHistoryScreen, 'Log in to view transfer history.')} options={{ title: 'Transfer History' }} />
      <Stack.Screen name="Convert" component={guestGuard(ConvertScreen, 'Log in to convert assets.')} options={{ title: 'Convert' }} />
      <Stack.Screen name="ConvertHistory" component={guestGuard(ConvertHistoryScreen, 'Log in to view convert history.')} options={{ title: 'Convert History' }} />
      <Stack.Screen name="TransactionHistory" component={guestGuard(TransactionHistoryScreen, 'Log in to view transaction history.')} options={{ title: 'Transactions' }} />
      <Stack.Screen name="FundHistory" component={guestGuard(FundHistoryScreen, 'Log in to view fund history.')} options={{ title: 'Fund History' }} />
      <Stack.Screen name="DepositHome" component={guestGuard(DepositHomeScreen, 'Log in to deposit.')} options={{ title: 'Deposit' }} />
      <Stack.Screen name="DepositNetwork" component={guestGuard(DepositNetworkScreen, 'Log in to deposit.')} options={{ title: 'Select Network' }} />
      <Stack.Screen name="DepositAddress" component={guestGuard(DepositAddressScreen, 'Log in to deposit.')} options={{ title: 'Deposit Address' }} />
      <Stack.Screen name="DepositHistory" component={guestGuard(DepositHistoryScreen, 'Log in to view deposit history.')} options={{ title: 'Deposit History' }} />
      <Stack.Screen name="DepositDetail" component={guestGuard(DepositDetailScreen, 'Log in to view deposit details.')} options={{ title: 'Deposit Detail' }} />
      <Stack.Screen name="WithdrawHome" component={guestGuard(WithdrawHomeScreen, 'Log in to withdraw.')} options={{ title: 'Withdraw' }} />
      <Stack.Screen name="WithdrawForm" component={guestGuard(WithdrawFormScreen, 'Log in to withdraw.')} options={{ title: 'Withdraw' }} />
      <Stack.Screen name="WithdrawConfirm" component={guestGuard(WithdrawConfirmScreen, 'Log in to withdraw.')} options={{ title: 'Confirm' }} />
      <Stack.Screen name="WithdrawalHistory" component={guestGuard(WithdrawalHistoryScreen, 'Log in to view withdrawal history.')} options={{ title: 'Withdrawals' }} />
      <Stack.Screen name="WithdrawalDetail" component={guestGuard(WithdrawalDetailScreen, 'Log in to view withdrawal details.')} options={{ title: 'Withdrawal' }} />
      <Stack.Screen name="AddressBook" component={guestGuard(AddressBookScreen, 'Log in to manage addresses.')} options={{ title: 'Address Book' }} />
      <Stack.Screen name="AddAddress" component={guestGuard(AddAddressScreen, 'Log in to add addresses.')} options={{ title: 'Add Address' }} />
      <Stack.Screen name="EditAddress" component={guestGuard(EditAddressScreen, 'Log in to edit addresses.')} options={{ title: 'Edit Address' }} />
    </Stack.Navigator>
  );
}
