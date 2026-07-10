import { useEffect, type ReactNode } from 'react';
import { createHttpClient } from '@core/api/httpClient';
import { getApiBaseUrl } from '@core/config/env';
import { createAuthHooks } from '@core/api/authHooks';

/** Wires HTTP auth hooks — session restore handled in launchFlow. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    createHttpClient({ getBaseUrl: getApiBaseUrl, authHooks: createAuthHooks() });
  }, []);

  return <>{children}</>;
}
