import type { WalletNamespace, WalletProviderId } from './types';

export type WalletProviderDefinition = {
  id: WalletProviderId;
  label: string;
  namespace: WalletNamespace;
  /** Public wallet URL scheme. Not an application package id. */
  scheme: string;
};

/**
 * Schemes the connector can hand off to. A listed wallet is not treated as
 * verified until that wallet app completes a real signing ceremony.
 */
export const WALLET_PROVIDERS: readonly WalletProviderDefinition[] = [
  { id: 'metamask', label: 'MetaMask', namespace: 'eip155', scheme: 'metamask://' },
  { id: 'trust', label: 'Trust Wallet', namespace: 'eip155', scheme: 'trust://' },
  { id: 'coinbase', label: 'Coinbase Wallet', namespace: 'eip155', scheme: 'cbwallet://' },
  { id: 'phantom', label: 'Phantom', namespace: 'solana', scheme: 'phantom://' },
];

export function getWalletProvider(id: WalletProviderId): WalletProviderDefinition {
  const provider = WALLET_PROVIDERS.find((item) => item.id === id);
  if (!provider) {
    throw new Error('UNKNOWN_WALLET');
  }
  return provider;
}
