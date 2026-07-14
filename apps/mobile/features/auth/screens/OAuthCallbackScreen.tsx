import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Loader } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { useOAuthCallback } from '../hooks/useOAuth';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

type Props = NativeStackScreenProps<AuthStackParamList, 'OAuthCallback'>;

export function OAuthCallbackScreen({ route }: Props) {
  const callback = useOAuthCallback();
  const { provider, code, state } = route.params;
  const fired = useRef(false);

  useEffect(() => {
    if (code && state && !fired.current) {
      fired.current = true;
      callback.mutate({ provider, code, state });
    }
  }, [code, state, provider, callback]);

  return (
    <AuthSplitLayout testID="S-115" showMarketingLogo>
      <AuthFormHeading title="Signing you in…" subtitle={`Connecting ${provider}`} />
      <View style={{ alignItems: 'center', paddingVertical: 48 }}>
        <Loader size="lg" />
      </View>
    </AuthSplitLayout>
  );
}
