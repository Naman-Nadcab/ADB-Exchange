/**
 * Sanctions / Travel Rule screening — Tier-1 fail-closed.
 * When provider is configured: call provider; on any failure return allowed: false.
 * In production with no provider configured: return allowed: false (refuse to allow without screening).
 * Config: env (SANCTIONS_*) or system_settings (SANCTIONS_PROVIDER, SANCTIONS_API_URL, SANCTIONS_API_KEY).
 */

import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { db } from '../lib/database.js';
import { resolveProviderSecret } from '../lib/provider-secret.js';
import {
  isOfficialPublicListsProvider,
  screenOfficialPublicLists,
} from './sanctions/official-public-lists.js';

export interface SanctionsCheckParams {
  /** On-chain address or counterparty identifier */
  address?: string;
  /** Counterparty name (Travel Rule) */
  name?: string;
  /** Amount in token units */
  amount: string;
  /** Asset symbol */
  asset: string;
  /** User ID for audit */
  userId: string;
}

export interface SanctionsCheckResult {
  allowed: boolean;
  /** Provider-specific risk score 0–100 */
  riskScore?: number;
  /** Block reason if not allowed */
  reason?: string;
  /** Provider name for audit */
  provider?: string;
}

const SANCTIONS_UNAVAILABLE = 'Sanctions service unavailable';
const SANCTIONS_NOT_CONFIGURED = 'Sanctions provider not configured (production requires screening)';

/** Provider explicitly denied the withdrawal. Transport and configuration failures are not matches. */
export function isSanctionsMatch(result: SanctionsCheckResult): boolean {
  if (result.allowed) return false;
  const reason = result.reason ?? '';
  return reason !== SANCTIONS_UNAVAILABLE && reason !== SANCTIONS_NOT_CONFIGURED;
}

/** Env/admin values that mean "no provider" — must not block api_settings activation. */
export function isPlaceholderSanctionsProvider(provider: string): boolean {
  const p = (provider || '').trim().toLowerCase();
  return !p || p === 'noop' || p === 'none' || p === 'mock' || p === 'disabled';
}

export interface SanctionsConfig {
  provider: string;
  apiUrl: string;
  apiKey: string;
}

/** Get sanctions config — Admin api_settings (primary) → system_settings → env (legacy bootstrap). */
export async function getSanctionsConfig(): Promise<SanctionsConfig> {
  let provider = '';
  let apiUrl = '';
  let apiKey = '';

  try {
    const { dynamicConfig } = await import('./dynamic-config.service.js');
    const fromApi = await dynamicConfig.getSanctionsProviderConfig();
    if (fromApi?.apiKey && fromApi.provider && !isPlaceholderSanctionsProvider(fromApi.provider)) {
      provider = fromApi.provider;
      apiUrl = fromApi.apiUrl;
      apiKey = fromApi.apiKey;
    }
  } catch {
    /* best-effort */
  }

  if (!apiKey || isPlaceholderSanctionsProvider(provider)) {
    provider = process.env.SANCTIONS_PROVIDER?.trim() ?? provider;
    apiUrl = process.env.SANCTIONS_API_URL?.trim() ?? apiUrl;
    apiKey = process.env.SANCTIONS_API_KEY?.trim() ?? apiKey;
  }

  if (!apiUrl || !apiKey) {
    try {
      const rows = await db.query<{ key: string; value: unknown }>(
        `SELECT key, value FROM system_settings WHERE key IN ('SANCTIONS_PROVIDER', 'SANCTIONS_API_URL', 'SANCTIONS_API_KEY')`
      );
      const map = Object.fromEntries(
        (rows.rows ?? []).map((r) => [r.key, typeof r.value === 'string' ? r.value : String(r.value ?? '')])
      );
      if (map.SANCTIONS_PROVIDER && !provider && !isPlaceholderSanctionsProvider(map.SANCTIONS_PROVIDER)) {
        provider = map.SANCTIONS_PROVIDER;
      }
      if (map.SANCTIONS_API_URL && !apiUrl) apiUrl = map.SANCTIONS_API_URL;
      if (map.SANCTIONS_API_KEY && !apiKey) apiKey = map.SANCTIONS_API_KEY;
    } catch {
      // ignore
    }
  }

  if (!apiKey || !provider) {
    try {
      const aml = await db.query<{
        provider: string;
        api_url: string | null;
        api_key: string | null;
        api_secret: string | null;
        secret_encrypted: boolean | null;
      }>(
        `SELECT provider, api_url, api_key, api_secret, secret_encrypted FROM api_settings
         WHERE category = 'aml' AND is_active = TRUE
         ORDER BY priority ASC, is_default DESC, updated_at DESC LIMIT 1`
      );
      const row = aml.rows[0];
      if (row && !isPlaceholderSanctionsProvider(row.provider)) {
        if (!provider) provider = row.provider;
        if (!apiUrl && row.api_url) apiUrl = row.api_url;
        if (!apiKey) {
          apiKey = resolveProviderSecret(row.api_secret, row.secret_encrypted)?.trim()
            || row.api_key?.trim() || '';
        }
      }
    } catch {
      // ignore
    }
  }

  if (isPlaceholderSanctionsProvider(provider)) {
    provider = '';
    apiUrl = '';
    apiKey = '';
  }

  return { provider, apiUrl, apiKey };
}

const CHAINALYSIS_PUBLIC_BASE = 'https://public.chainalysis.com/api/v1/address';

function isChainalysisPublicProvider(provider: string, apiUrl: string): boolean {
  const p = provider.toLowerCase();
  return p === 'chainalysis' || p === 'chainalysis_public' || apiUrl.includes('public.chainalysis.com');
}

/** Chainalysis free public sanctions API (GET /api/v1/address/{address}). */
async function callChainalysisPublicApi(
  params: SanctionsCheckParams,
  apiKey: string
): Promise<SanctionsCheckResult> {
  const address = params.address?.trim();
  if (!address) {
    return { allowed: true, provider: 'chainalysis_public', reason: 'no_address_to_screen' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${CHAINALYSIS_PUBLIC_BASE}/${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('Chainalysis public API non-OK', {
        status: res.status,
        userId: params.userId,
      });
      return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider: 'chainalysis_public' };
    }

    const data = (await res.json()) as { identifications?: unknown[] };
    const hits = Array.isArray(data.identifications) ? data.identifications.length : 0;
    if (hits > 0) {
      return {
        allowed: false,
        reason: 'Address matches sanctions designation',
        provider: 'chainalysis_public',
        riskScore: 100,
      };
    }
    return { allowed: true, provider: 'chainalysis_public', riskScore: 0 };
  } catch (e) {
    logger.warn('Chainalysis public API failed (fail closed)', {
      error: e instanceof Error ? e.message : String(e),
      userId: params.userId,
    });
    return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider: 'chainalysis_public' };
  }
}

/**
 * Call external sanctions API (Chainalysis, Elliptic, TRM, or OFAC gateway).
 * Returns allowed: false on any error (fail closed).
 */
async function callSanctionsProvider(
  params: SanctionsCheckParams,
  provider: string,
  apiUrl: string,
  apiKey: string
): Promise<SanctionsCheckResult> {
  if (!apiKey) {
    logger.warn('Sanctions provider configured but SANCTIONS_API_KEY missing', {
      provider,
      userId: params.userId,
    });
    return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider };
  }

  if (isChainalysisPublicProvider(provider, apiUrl)) {
    return callChainalysisPublicApi(params, apiKey);
  }

  if (!apiUrl) {
    logger.warn('Sanctions provider configured but SANCTIONS_API_URL missing', {
      provider,
      userId: params.userId,
    });
    return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        address: params.address,
        name: params.name,
        amount: params.amount,
        asset: params.asset,
        userId: params.userId,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('Sanctions API returned non-OK', {
        status: res.status,
        provider,
        userId: params.userId,
      });
      return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider };
    }

    const data = (await res.json()) as { allowed?: boolean; riskScore?: number; reason?: string };
    const allowed = data.allowed !== false;
    return {
      allowed,
      riskScore: data.riskScore,
      reason: data.reason,
      provider,
    };
  } catch (e) {
    logger.warn('Sanctions check failed (fail closed)', {
      error: e instanceof Error ? e.message : String(e),
      provider,
      userId: params.userId,
    });
    return { allowed: false, reason: SANCTIONS_UNAVAILABLE, provider };
  }
}

/**
 * Tier-1: Fail closed. No provider in production -> block. Provider error -> block.
 */
export async function checkSanctions(params: SanctionsCheckParams): Promise<SanctionsCheckResult> {
  const { provider, apiUrl, apiKey } = await getSanctionsConfig();
  const isProduction = config.isProduction;

  if (isPlaceholderSanctionsProvider(provider)) {
    if (!isProduction) {
      return { allowed: true, provider: 'noop' };
    }
    logger.warn('Sanctions check in production without provider — blocking', { userId: params.userId });
    return {
      allowed: false,
      reason: SANCTIONS_NOT_CONFIGURED,
    };
  }

  if (isOfficialPublicListsProvider(provider)) {
    const listed = await screenOfficialPublicLists({ address: params.address });
    return {
      allowed: listed.allowed,
      reason: listed.reason,
      provider: listed.provider,
      riskScore: listed.riskScore,
    };
  }

  if (!provider || !apiKey) {
    if (isProduction) {
      logger.warn('Sanctions check in production without provider — blocking', { userId: params.userId });
      return {
        allowed: false,
        reason: SANCTIONS_NOT_CONFIGURED,
      };
    }
    return { allowed: true };
  }

  if (isChainalysisPublicProvider(provider, apiUrl) || apiUrl) {
    try {
      const result = await callSanctionsProvider(params, provider, apiUrl, apiKey);
      return result;
    } catch (e) {
      logger.warn('Sanctions check threw (fail closed)', {
        error: e instanceof Error ? e.message : String(e),
        userId: params.userId,
      });
      return {
        allowed: false,
        reason: SANCTIONS_UNAVAILABLE,
        provider,
      };
    }
  }

  if (isProduction) {
    return { allowed: false, reason: SANCTIONS_NOT_CONFIGURED };
  }
  return { allowed: true };
}
