/**
 * CAIP-10 account parser for wallet authentication challenges.
 * Supported namespaces are exactly eip155 and solana.
 * Chain allowlists are not applied here; supported-chain policy belongs to
 * the later verification and configuration phase.
 */

import { PublicKey } from '@solana/web3.js';

export type WalletNamespace = 'eip155' | 'solana';

export type CaipErrorCode =
  | 'MALFORMED'
  | 'UNSUPPORTED_NAMESPACE'
  | 'INVALID_REFERENCE'
  | 'INVALID_ADDRESS';

export class CaipParseError extends Error {
  readonly code: CaipErrorCode;

  constructor(code: CaipErrorCode) {
    super(code);
    this.name = 'CaipParseError';
    this.code = code;
  }
}

export type ParsedCaip10 = {
  namespace: WalletNamespace;
  chainReference: string;
  /** Address as submitted. Solana case is preserved. EVM is not checksummed. */
  address: string;
  /** EVM lowercased. Solana kept exactly as submitted. */
  normalizedAddress: string;
  caip10: string;
};

const MAX_CAIP10_LENGTH = 256;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const EVM_CHAIN_REFERENCE = /^(0|[1-9][0-9]{0,19})$/;
const SOLANA_CHAIN_REFERENCE = /^[-_a-zA-Z0-9]{1,64}$/;

function isCanonicalSolanaAddress(address: string): boolean {
  try {
    const key = new PublicKey(address);
    return key.toBase58() === address;
  } catch {
    return false;
  }
}

/**
 * Split a CAIP-10 account id into namespace, chain reference, and address.
 * Exactly three colon-separated parts are accepted. A reference that itself
 * contains a colon is rejected as malformed.
 */
export function parseCaip10(input: string): ParsedCaip10 {
  if (typeof input !== 'string') throw new CaipParseError('MALFORMED');
  const caip10 = input.trim();
  if (!caip10 || caip10.length > MAX_CAIP10_LENGTH) throw new CaipParseError('MALFORMED');

  const parts = caip10.split(':');
  if (parts.length !== 3) throw new CaipParseError('MALFORMED');
  const namespace = parts[0] ?? '';
  const chainReference = parts[1] ?? '';
  const address = parts[2] ?? '';
  if (!namespace || !chainReference || !address) throw new CaipParseError('MALFORMED');

  if (namespace !== 'eip155' && namespace !== 'solana') {
    throw new CaipParseError('UNSUPPORTED_NAMESPACE');
  }

  if (namespace === 'eip155') {
    if (!EVM_CHAIN_REFERENCE.test(chainReference)) throw new CaipParseError('INVALID_REFERENCE');
    if (!EVM_ADDRESS.test(address)) throw new CaipParseError('INVALID_ADDRESS');
    return {
      namespace,
      chainReference,
      address,
      normalizedAddress: address.toLowerCase(),
      caip10,
    };
  }

  if (!SOLANA_CHAIN_REFERENCE.test(chainReference)) throw new CaipParseError('INVALID_REFERENCE');
  if (!isCanonicalSolanaAddress(address)) throw new CaipParseError('INVALID_ADDRESS');
  return {
    namespace,
    chainReference,
    address,
    normalizedAddress: address,
    caip10,
  };
}
