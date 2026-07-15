import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WalletHistoryScreen } from './WalletHistoryScreen';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'ConvertHistory'>;

export function ConvertHistoryScreen({ navigation, route }: Props) {
  return <WalletHistoryScreen navigation={navigation} route={route} initialTab="convert" />;
}
