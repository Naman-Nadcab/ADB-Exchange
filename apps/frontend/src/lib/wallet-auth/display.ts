/** Compact address for security cards. The full address stays available to copy. */
export function shortAddress(address: string): string {
  const value = address.trim();
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function sameWalletAddress(namespace: string, left: string, right: string): boolean {
  if (namespace === 'eip155') return left.toLowerCase() === right.toLowerCase();
  return left === right;
}
