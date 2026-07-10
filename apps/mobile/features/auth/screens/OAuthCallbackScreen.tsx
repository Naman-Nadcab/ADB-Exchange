import { useEffect, useRef } from 'react';
import { Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useOAuthCallback } from '../hooks/useOAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'OAuthCallback'>;

export function OAuthCallbackScreen({ route }: Props) {
  const { theme } = useTheme();
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
    <ScreenLayout testID="S-115">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        Signing you in…
      </Text>
      <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
});
