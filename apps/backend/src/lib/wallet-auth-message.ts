/**
 * Parser for the STEP 3 SIWE / SIWS authentication message.
 * The stored challenge text remains authoritative. This parser checks that
 * the exact text also binds the fields STEP 3 wrote into it.
 */

import type { WalletNamespace } from './caip10.js';
import { AUTH_ONLY_STATEMENT } from '../services/wallet-auth-challenge.service.js';

export type ParsedWalletAuthMessage = {
  namespace: WalletNamespace;
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const EVM_CHAIN = /^(0|[1-9][0-9]{0,19})$/;

function field(line: string, label: string): string | null {
  const prefix = `${label}: `;
  if (!line.startsWith(prefix)) return null;
  const value = line.slice(prefix.length);
  if (!value || value !== value.trim()) return null;
  return value;
}

/**
 * Parse the exact STEP 3 message layout. Returns null on any extra line,
 * missing field, or unexpected label. Does not recover a signer.
 */
export function parseWalletAuthMessage(message: string): ParsedWalletAuthMessage | null {
  if (typeof message !== 'string' || message.length === 0 || message.length > 4096) return null;
  if (message.includes('\r')) return null;
  const lines = message.split('\n');
  if (lines.length !== 11) return null;

  const header = lines[0] ?? '';
  let namespace: WalletNamespace | null = null;
  let domain = '';
  const evmSuffix = ' wants you to sign in with your Ethereum account:';
  const solSuffix = ' wants you to sign in with your Solana account:';
  if (header.endsWith(evmSuffix)) {
    namespace = 'eip155';
    domain = header.slice(0, -evmSuffix.length);
  } else if (header.endsWith(solSuffix)) {
    namespace = 'solana';
    domain = header.slice(0, -solSuffix.length);
  } else {
    return null;
  }
  if (!domain || domain !== domain.trim() || domain.includes(' ')) return null;

  const address = lines[1] ?? '';
  if (!address || address !== address.trim()) return null;
  if (lines[2] !== '' || lines[4] !== '') return null;
  if (lines[3] !== AUTH_ONLY_STATEMENT) return null;

  const uri = field(lines[5] ?? '', 'URI');
  const version = field(lines[6] ?? '', 'Version');
  const chainField = field(lines[7] ?? '', 'Chain ID');
  const nonce = field(lines[8] ?? '', 'Nonce');
  const issuedAt = field(lines[9] ?? '', 'Issued At');
  const expirationTime = field(lines[10] ?? '', 'Expiration Time');
  if (!uri || !version || !chainField || !nonce || !issuedAt || !expirationTime) return null;
  if (version !== '1') return null;
  if (!RFC3339_SECONDS.test(issuedAt) || !RFC3339_SECONDS.test(expirationTime)) return null;
  if (!/^[A-Za-z0-9]{8,128}$/.test(nonce)) return null;

  let chainReference = '';
  if (namespace === 'eip155') {
    if (!EVM_CHAIN.test(chainField)) return null;
    chainReference = chainField;
  } else {
    const prefix = 'solana:';
    if (!chainField.startsWith(prefix)) return null;
    chainReference = chainField.slice(prefix.length);
    if (!chainReference || chainReference.includes(':')) return null;
  }

  return {
    namespace,
    domain,
    address,
    statement: AUTH_ONLY_STATEMENT,
    uri,
    version,
    chainReference,
    nonce,
    issuedAt,
    expirationTime,
  };
}
