import { useEffect } from 'react';
import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { formatNetworkLabel } from '@core/domain/wallet/withdraw';
import { useTokenChains } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositNetwork'>;

export function DepositNetworkScreen({ route, navigation }: Props) {
  const { symbol, name } = route.params;
  const { theme } = useTheme();
  const q = useTokenChains(symbol);

  useEffect(() => {
    analytics.screen('S-511');
  }, []);

  return (
    <ScreenLayout testID="S-511">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Select network for {name} ({symbol})
      </Text>
      <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginBottom: 12 }}>
        Sending on the wrong network may result in permanent loss of funds.
      </Text>
      {q.isLoading ? (
        <SkeletonList rows={4} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const disabled = item.is_active === false;
            return (
              <Pressable
                style={[styles.row, disabled && styles.disabled]}
                disabled={disabled}
                onPress={() =>
                  navigation.navigate('DepositAddress', {
                    symbol,
                    chainId: item.id,
                    chainName: item.name,
                  })
                }
                accessibilityLabel={`Network ${item.name}${disabled ? ' unavailable' : ''}`}
              >
                <Text
                  style={{
                    color: `hsl(${disabled ? theme.colors.foregroundSecondary : theme.colors.foregroundPrimary})`,
                    fontWeight: '600',
                  }}
                >
                  {formatNetworkLabel(item.name, item.confirmations_required)}
                  {disabled ? ' · Unavailable' : ''}
                </Text>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                  {item.type?.toUpperCase()}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: `hsl(${theme.colors.statusError})` }}>No supported networks</Text>
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { paddingVertical: 14, minHeight: 44 },
  disabled: { opacity: 0.45 },
});
