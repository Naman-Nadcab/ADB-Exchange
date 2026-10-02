const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58-encode signature bytes. Solana login signatures are not hex. */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  if (zeros === bytes.length) return '1'.repeat(zeros);
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i] ?? 0;
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58[digits[i] ?? 0] ?? '';
  return out;
}

/** Hex form of the exact UTF-8 message for EIP-191 personal_sign. */
export function utf8MessageToHex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let hex = '0x';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexChainToReference(chainId: string): string {
  const value = BigInt(chainId);
  return value.toString(10);
}

export function evmCaip10(chainReference: string, address: string): string {
  return `eip155:${chainReference}:${address}`;
}

export function solanaCaip10(chainReference: string, address: string): string {
  return `solana:${chainReference}:${address}`;
}

export function caip10ForAccount(account: {
  namespace: 'eip155' | 'solana';
  chainReference: string;
  address: string;
}): string {
  return account.namespace === 'eip155'
    ? evmCaip10(account.chainReference, account.address)
    : solanaCaip10(account.chainReference, account.address);
}
