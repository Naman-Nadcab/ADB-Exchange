/** Mask a real email. Missing wallet-native emails stay a neutral label, never "null". */
export function maskAccountEmail(email: string | null | undefined, emptyLabel: string): string {
  if (typeof email !== 'string') return emptyLabel;
  const value = email.trim();
  if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return emptyLabel;
  const [local, domain] = value.split('@');
  if (!local || !domain) return emptyLabel;
  return `${local.slice(0, 3)}**${local.length > 5 ? local.slice(-1) : ''}@****`;
}
