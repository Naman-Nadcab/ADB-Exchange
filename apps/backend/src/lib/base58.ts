/**
 * Base58 decoder for Solana account addresses and detached signatures.
 * Alphabet matches Bitcoin/Solana base58. Rejects characters outside it.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function decodeBase58(input: string): Uint8Array {
  if (typeof input !== 'string' || input.length === 0 || input.length > 128) {
    throw new Error('INVALID_BASE58');
  }
  const bytes: number[] = [0];
  for (let i = 0; i < input.length; i++) {
    const value = ALPHABET.indexOf(input[i]!);
    if (value === -1) throw new Error('INVALID_BASE58');
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] ?? 0) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; input[i] === '1' && i < input.length - 1; i++) {
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}
