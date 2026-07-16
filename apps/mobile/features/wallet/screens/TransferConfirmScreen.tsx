import { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner, SkeletonList } from '@shared/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { mapTransferApiError } from '@core/domain/wallet/transfer';
import { useExecuteTransfer } from '../hooks/useWallet';
import { TransferFlowHeader } from '../components/TransferFlowHeader';
import { TransferPreviewCard } from '../components/TransferPreviewCard';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'TransferConfirm'>;

export function TransferConfirmScreen({ navigation, route }: Props) {
  const p = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const transfer = useExecuteTransfer();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const paramsValid =
    !!p?.fromAccount &&
    !!p?.toAccount &&
    !!p?.tokenId &&
    !!p?.symbol &&
    !!p?.amount;

  useEffect(() => {
    analytics.screen('S-531');
  }, []);

  useEffect(() => {
    if (!paramsValid) {
      navigation.replace('Transfer');
    }
  }, [paramsValid, navigation]);

  const onRefresh = useCallback(() => {}, []);

  if (!paramsValid) {
    return (
      <ScreenLayout testID="S-531">
        <SkeletonList rows={4} />
      </ScreenLayout>
    );
  }

  const submit = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot transfer until reconnected');
      return;
    }
    try {
      await transfer.mutateAsync({
        fromAccount: p.fromAccount,
        toAccount: p.toAccount,
        tokenId: p.tokenId,
        amount: p.amount,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? mapTransferApiError(err.code, err.message) : 'Transfer failed');
    }
  };

  if (success) {
    return (
      <ScreenLayout testID="S-531-success">
        <View style={[styles.successBox, { backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.12)` }]}>
          <Ionicons name="checkmark-circle" size={32} color={`hsl(${theme.colors.tradeBuy})`} />
          <Text style={{ color: `hsl(${theme.colors.tradeBuy})`, fontWeight: '700', fontSize: 16, marginTop: 8 }}>
            Transfer completed successfully!
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            {p.amount} {p.symbol} moved to {p.toAccount} account.
          </Text>
        </View>
        <PrimaryButton title="View Transfer History" onPress={() => navigation.replace('TransferHistory')} />
        <PrimaryButton title="New Transfer" variant="secondary" onPress={() => navigation.popToTop()} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-531">
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}>
        <TransferFlowHeader step="Step 2 · Confirm transfer" />
        {!isOnline ? <ErrorBanner message="Offline — cannot submit transfer" /> : null}

        <TransferPreviewCard
          fromAccount={p.fromAccount}
          toAccount={p.toAccount}
          symbol={p.symbol}
          amount={p.amount}
        />

        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginBottom: 12 }}>
          Account transfers do not require 2FA or fund password. Review details before confirming.
        </Text>

        {error ? <ErrorBanner message={error} onRetry={() => void submit()} /> : null}

        <PrimaryButton
          title={transfer.isPending ? 'Processing…' : 'Confirm Transfer'}
          loading={transfer.isPending}
          onPress={() => void submit()}
        />
        <PrimaryButton title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  successBox: { alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 20, marginTop: 20 },
});
