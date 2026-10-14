import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { WALLET_PROVIDERS } from '@core/wallet-auth/providers';
import {
  WALLET_SIGNATURE_NOTICE,
  WALLET_SIGNUP_TITLE,
  WALLET_SIGN_IN_TITLE,
  isRetryableWalletPhase,
} from '@core/wallet-auth/copy';
import { useWalletLogin } from '../hooks/useWalletLogin';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginWallet'>;

export function LoginWalletScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const intent = route.params?.intent ?? 'login';
  const wallet = useWalletLogin();
  const busy =
    wallet.phase === 'CONNECTING' ||
    wallet.phase === 'WAITING_FOR_WALLET' ||
    wallet.phase === 'SIGNING' ||
    wallet.phase === 'RETURNING' ||
    wallet.phase === 'VERIFYING';
  const failed = isRetryableWalletPhase(wallet.phase);

  return (
    <AuthSplitLayout testID="S-101-wallet" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title={intent === 'signup' ? WALLET_SIGNUP_TITLE : WALLET_SIGN_IN_TITLE}
        subtitle={WALLET_SIGNATURE_NOTICE}
      />
      <View accessibilityRole="radiogroup" accessibilityLabel="Choose a wallet" style={{ gap: theme.spacing[3] }}>
        {WALLET_PROVIDERS.map((provider) => {
          const selected = wallet.providerId === provider.id;
          return (
            <Pressable
              key={provider.id}
              accessibilityRole="radio"
              accessibilityLabel={provider.label}
              accessibilityState={{ selected, disabled: busy }}
              disabled={busy}
              onPress={() => wallet.setProviderId(provider.id)}
              style={{
                minHeight: theme.sizes.tapTarget,
                paddingVertical: theme.spacing[3],
                paddingHorizontal: theme.spacing[4],
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: `hsl(${selected ? theme.colors.brandPrimary : theme.colors.borderDefault})`,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                style={[
                  theme.typography.bodyMd,
                  { fontFamily: theme.fonts.sansMedium, color: `hsl(${theme.colors.foregroundPrimary})` },
                ]}
              >
                {provider.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[4] },
        ]}
      >
        {wallet.statusText}
      </Text>
      {failed ? <ErrorBanner message={wallet.statusText} /> : null}
      <PrimaryButton
        title={failed ? 'Try again' : 'Connect wallet'}
        accessibilityLabel={failed ? 'Try wallet sign-in again' : 'Connect wallet'}
        size="xl"
        loading={busy}
        disabled={!wallet.providerId}
        onPress={() => void wallet.start()}
        style={{ marginTop: theme.spacing[4] }}
      />
    </AuthSplitLayout>
  );
}
