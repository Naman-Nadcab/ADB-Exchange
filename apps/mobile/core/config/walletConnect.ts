import Constants from 'expo-constants';

/**
 * Public WalletConnect Cloud project id.
 * This is configuration, not a secret. An empty value means live relay pairing is inactive.
 * The EAS project id is unrelated and must not be reused here.
 */
export function getWalletConnectProjectId(): string {
  const extra = Constants.expoConfig?.extra as { walletConnectProjectId?: unknown } | undefined;
  const fromExtra = typeof extra?.walletConnectProjectId === 'string' ? extra.walletConnectProjectId.trim() : '';
  if (fromExtra) return fromExtra;
  return process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';
}
