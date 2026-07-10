/** Client-side validation only — permissions enforced by backend. */

export function validateApiKeyLabel(label: string): string | null {
  const t = label.trim();
  if (!t) return 'Label is required';
  if (t.length > 64) return 'Label is too long';
  return null;
}
