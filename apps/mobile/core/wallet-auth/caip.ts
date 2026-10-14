import type { WalletAccountSnapshot, WalletNamespace } from './types';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function caip10ForAccount(account: WalletAccountSnapshot): string {
  if (account.namespace === 'solana') {
    return `solana:${account.chainReference}:${account.address}`;
  }
  return `eip155:${account.chainReference}:${account.address}`;
}

export function isWalletNamespace(value: string): value is WalletNamespace {
  return value === 'eip155' || value === 'solana';
}

export function isPlausibleAddress(namespace: WalletNamespace, address: string): boolean {
  if (namespace === 'eip155') return EVM_ADDRESS.test(address);
  return SOLANA_ADDRESS.test(address);
}

export function sameWalletAccount(left: WalletAccountSnapshot, right: WalletAccountSnapshot): boolean {
  if (left.namespace !== right.namespace || left.chainReference !== right.chainReference) return false;
  if (left.namespace === 'solana') return left.address === right.address;
  return left.address.toLowerCase() === right.address.toLowerCase();
}

/** Application identity must be users.id, never the wallet address. */
export function sessionUserIsCanonical(userId: string, walletAddress: string): boolean {
  if (!userId || !walletAddress) return false;
  if (userId === walletAddress) return false;
  if (userId.toLowerCase() === walletAddress.toLowerCase()) return false;
  return true;
}
