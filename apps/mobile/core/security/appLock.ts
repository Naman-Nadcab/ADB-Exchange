import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage, SECURE_KEYS } from '@core/storage/secureStorage';

const DEFAULT_TIMEOUT_SEC = 60;

async function hashPin(pin: string): Promise<string> {
  const data = `metheorium:${pin}`;
  return globalThis.crypto?.subtle
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then((b) =>
        Array.from(new Uint8Array(b))
          .map((x) => x.toString(16).padStart(2, '0'))
          .join(''),
      )
    : `fallback-${data.length}-${pin.length}`;
}

export const appLock = {
  async isEnabled(): Promise<boolean> {
    const v = await mmkvStorage.get(CACHE_KEYS.appLockEnabled);
    return v === 'true';
  },

  async setEnabled(enabled: boolean): Promise<void> {
    await mmkvStorage.set(CACHE_KEYS.appLockEnabled, enabled ? 'true' : 'false');
  },

  async getTimeoutSec(): Promise<number> {
    const v = await mmkvStorage.get(CACHE_KEYS.appLockTimeout);
    return v ? Number(v) : DEFAULT_TIMEOUT_SEC;
  },

  async setTimeoutSec(sec: number): Promise<void> {
    await mmkvStorage.set(CACHE_KEYS.appLockTimeout, String(sec));
  },

  async setPin(pin: string): Promise<void> {
    const hash = await hashPin(pin);
    await secureStorage.set(SECURE_KEYS.pinHash, hash);
  },

  async verifyPin(pin: string): Promise<boolean> {
    const stored = await secureStorage.get(SECURE_KEYS.pinHash);
    if (!stored) return false;
    return stored === (await hashPin(pin));
  },

  async canUseBiometrics(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  },

  async promptUnlock(reason = 'Unlock METHErium'): Promise<boolean> {
    const enabled = await this.isEnabled();
    if (!enabled) return true;
    const bio = await this.canUseBiometrics();
    if (!bio) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use PIN',
    });
    return result.success;
  },
};
