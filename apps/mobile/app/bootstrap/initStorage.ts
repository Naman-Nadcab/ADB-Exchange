import { secureStorage } from '@core/storage/secureStorage';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { crashReporting } from '@core/observability/crashReporting';

export async function initStorage(): Promise<void> {
  await secureStorage.get('__probe__');
  mmkvStorage.getString('__probe__');
}

export function initObservability(): void {
  crashReporting.init();
}
