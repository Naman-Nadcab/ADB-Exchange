import type { WalletProviderDefinition } from './providers';
import { isPlausibleAddress, isWalletNamespace } from './caip';
import type { WalletAccountSnapshot } from './types';

/** Existing app scheme. Return traffic is not authentication. */
export const WALLET_RETURN_URL = 'metheorium://wallet-auth';

export type WalletReturnPayload =
  | { kind: 'connected'; requestId: string; account: WalletAccountSnapshot }
  | { kind: 'signed'; requestId: string; account: WalletAccountSnapshot; signature: string }
  | { kind: 'rejected'; requestId: string }
  | { kind: 'cancelled'; requestId: string }
  | { kind: 'invalid' }
  | { kind: 'unrelated' };

export function buildReturnUrl(requestId: string): string {
  return `${WALLET_RETURN_URL}?requestId=${encodeURIComponent(requestId)}`;
}

/**
 * External wallet handoff. A WalletConnect pairing URI is attached only when
 * a relay client actually produced one. The URI is not an application session.
 */
export function buildWalletHandoffUrl(input: {
  provider: WalletProviderDefinition;
  action: 'connect' | 'sign';
  returnUrl: string;
  message?: string;
  pairingUri?: string | null;
}): string {
  if (input.pairingUri) {
    return `${input.provider.scheme}wc?uri=${encodeURIComponent(input.pairingUri)}`;
  }
  const url = new URL(`${input.provider.scheme}metheorium`);
  url.searchParams.set('action', input.action);
  url.searchParams.set('redirect', input.returnUrl);
  if (input.message) url.searchParams.set('message', input.message);
  return url.toString();
}

export function parseWalletReturn(url: string): WalletReturnPayload {
  if (!url.startsWith(WALLET_RETURN_URL)) return { kind: 'unrelated' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'invalid' };
  }
  const requestId = parsed.searchParams.get('requestId') ?? '';
  if (!requestId) return { kind: 'invalid' };
  const status = parsed.searchParams.get('status');
  if (status === 'rejected') return { kind: 'rejected', requestId };
  if (status === 'cancelled' || status === 'cancel') return { kind: 'cancelled', requestId };

  const namespaceRaw = parsed.searchParams.get('namespace') ?? '';
  const chainReference = parsed.searchParams.get('chain') ?? '';
  const address = parsed.searchParams.get('address') ?? '';
  if (!isWalletNamespace(namespaceRaw) || !chainReference || !address) return { kind: 'invalid' };
  if (!isPlausibleAddress(namespaceRaw, address)) return { kind: 'invalid' };
  const account: WalletAccountSnapshot = {
    namespace: namespaceRaw,
    chainReference,
    address,
  };
  if (status === 'signed') {
    const signature = parsed.searchParams.get('signature') ?? '';
    if (!signature) return { kind: 'invalid' };
    const echoed = parsed.searchParams.get('message');
    if (echoed != null && echoed.length === 0) return { kind: 'invalid' };
    return { kind: 'signed', requestId, account, signature };
  }
  if (status === 'connected') return { kind: 'connected', requestId, account };
  return { kind: 'invalid' };
}
