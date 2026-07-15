import { useEffect } from 'react';
import { FlatList, Pressable, Text, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SecondaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useMyPaymentMethods, usePaymentMethodMutations } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'PaymentMethods'>;

export function PaymentMethodsScreen({ navigation }: Props) {
  const q = useMyPaymentMethods();
  const { remove, update } = usePaymentMethodMutations();

  useEffect(() => {
    analytics.screen('S-611');
  }, []);

  return (
    <ScreenLayout testID="S-611">
      <PrimaryButton title="Add method" onPress={() => navigation.navigate('AddPaymentMethod', {})} />
      <SecondaryButton
        title="Merchant dashboard"
        onPress={() => navigation.navigate('MerchantDashboard')}
        style={{ marginTop: 8 }}
      />
      <SecondaryButton
        title="Blocked advertisers"
        onPress={() => navigation.navigate('BlockedAdvertisers')}
        style={{ marginTop: 8, marginBottom: 8 }}
      />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={{ paddingVertical: 12 }}
            onPress={() => navigation.navigate('AddPaymentMethod', { id: item.id })}
            onLongPress={() =>
              Alert.alert('Delete?', item.display_name ?? item.method_name, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(item.id) },
              ])
            }
          >
            <Text style={{ fontWeight: '700' }}>
              {item.display_name ?? item.method_name} {item.is_default ? '· Default' : ''}
            </Text>
            <Text style={{ fontSize: 12 }}>
              {item.verification_status ?? '—'} · Priority {item.priority ?? 0}
            </Text>
            <Pressable onPress={() => update.mutate({ id: item.id, is_default: true })}>
              <Text>Set default</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </ScreenLayout>
  );
}
