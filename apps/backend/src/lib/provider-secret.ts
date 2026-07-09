/**
 * Shared dual-read secret resolver for api_settings rows.
 * Legacy rows may hold plaintext; encrypted rows use AES-256-GCM via hybrid-credentials-crypto.
 */
import { decryptProviderSecret } from './hybrid-credentials-crypto.js';
import { logger } from './logger.js';

export function resolveProviderSecret(
  secret: string | null | undefined,
  encrypted: boolean | null | undefined,
): string | null {
  if (!secret) return null;
  if (!encrypted) return secret;
  try {
    return decryptProviderSecret(secret);
  } catch (e) {
    logger.warn('api_settings secret decrypt failed; treating as plaintext', {
      error: e instanceof Error ? e.message : String(e),
    });
    return secret;
  }
}
