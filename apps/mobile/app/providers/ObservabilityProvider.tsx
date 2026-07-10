import { useEffect, type ReactNode } from 'react';
import { initObservability } from '@app/bootstrap/initObservability';

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initObservability();
  }, []);
  return <>{children}</>;
}
