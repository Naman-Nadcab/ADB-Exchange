import { mmkvStorage } from '@core/storage/mmkvStorage';

const DEVICE_KEY = 'device.id';

export async function getDeviceId(): Promise<string> {
  const existing = await mmkvStorage.get(DEVICE_KEY);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}`;
  await mmkvStorage.set(DEVICE_KEY, id);
  return id;
}
