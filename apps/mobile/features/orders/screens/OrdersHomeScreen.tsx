import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import type { OrdersStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrdersHome'>;

export function OrdersHomeScreen({ navigation }: Props) {
  useEffect(() => {
    analytics.screen('S-400');
  }, []);

  return (
    <ScreenLayout testID="S-400">
      <View style={styles.wrap}>
        <PrimaryButton title="Spot Order History" onPress={() => navigation.navigate('OrderHistory')} />
        <PrimaryButton title="P2P Orders" variant="secondary" onPress={() => navigation.getParent()?.navigate('P2P', { screen: 'OrdersList' })} />
        <PrimaryButton
          title="Trade History (Fills)"
          variant="secondary"
          onPress={() => navigation.navigate('TradeHistory')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 24 },
});
