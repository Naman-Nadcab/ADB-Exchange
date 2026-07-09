/**
 * CAPTCHA verification — reads active provider from Admin (api_settings).
 */
import { dynamicConfig } from './dynamic-config.service.js';
import { logger } from '../lib/logger.js';

export async function verifyCaptchaToken(token: string, remoteIp?: string): Promise<boolean> {
  const cfg = await dynamicConfig.getCaptchaConfig();
  if (!cfg) return true; // CAPTCHA not configured — do not block auth flows

  const trimmed = token?.trim();
  if (!trimmed) return false;

  try {
    let verifyUrl: string;
    let body: URLSearchParams;
    if (cfg.provider === 'turnstile') {
      verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      body = new URLSearchParams({ secret: cfg.secretKey, response: trimmed });
      if (remoteIp) body.set('remoteip', remoteIp);
    } else if (cfg.provider === 'hcaptcha') {
      verifyUrl = 'https://hcaptcha.com/siteverify';
      body = new URLSearchParams({ secret: cfg.secretKey, response: trimmed });
      if (remoteIp) body.set('remoteip', remoteIp);
    } else {
      verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
      body = new URLSearchParams({ secret: cfg.secretKey, response: trimmed });
      if (remoteIp) body.set('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(verifyUrl, { method: 'POST', body, signal: controller.signal });
    clearTimeout(timeout);
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (e) {
    logger.warn('CAPTCHA verification failed', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function getCaptchaSiteKey(): Promise<string | null> {
  const cfg = await dynamicConfig.getCaptchaConfig();
  return cfg?.siteKey ?? null;
}
