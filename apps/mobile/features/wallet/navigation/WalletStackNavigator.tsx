import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator<WalletStackParamList>();

export function WalletStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AssetsHome" component={AssetsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AssetDetail" component={AssetDetailScreen} options={{ title: 'Asset' }} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Transfer' }} />
      <Stack.Screen name="TransferHistory" component={TransferHistoryScreen} options={{ title: 'Transfer History' }} />
      <Stack.Screen name="Convert" component={ConvertScreen} options={{ title: 'Convert' }} />
      <Stack.Screen name="ConvertHistory" component={ConvertHistoryScreen} options={{ title: 'Convert History' }} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="FundHistory" component={FundHistoryScreen} options={{ title: 'Fund History' }} />
      <Stack.Screen name="DepositHome" component={DepositHomeScreen} options={{ title: 'Deposit' }} />
      <Stack.Screen name="DepositNetwork" component={DepositNetworkScreen} options={{ title: 'Select Network' }} />
      <Stack.Screen name="DepositAddress" component={DepositAddressScreen} options={{ title: 'Deposit Address' }} />
      <Stack.Screen name="DepositHistory" component={DepositHistoryScreen} options={{ title: 'Deposit History' }} />
      <Stack.Screen name="DepositDetail" component={DepositDetailScreen} options={{ title: 'Deposit Detail' }} />
      <Stack.Screen name="WithdrawHome" component={WithdrawHomeScreen} options={{ title: 'Withdraw' }} />
      <Stack.Screen name="WithdrawForm" component={WithdrawFormScreen} options={{ title: 'Withdraw' }} />
      <Stack.Screen name="WithdrawConfirm" component={WithdrawConfirmScreen} options={{ title: 'Confirm' }} />
      <Stack.Screen name="WithdrawalHistory" component={WithdrawalHistoryScreen} options={{ title: 'Withdrawals' }} />
      <Stack.Screen name="WithdrawalDetail" component={WithdrawalDetailScreen} options={{ title: 'Withdrawal' }} />
      <Stack.Screen name="AddressBook" component={AddressBookScreen} options={{ title: 'Address Book' }} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} options={{ title: 'Add Address' }} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} options={{ title: 'Edit Address' }} />
    </Stack.Navigator>
  );
}
