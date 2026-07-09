'use client';

import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminToastProvider } from '@/components/admin-shell/AdminToast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Shorter stale window so saved settings show fresh data after refetch/revisit. */
            staleTime: 30_000,
            gcTime: 30 * 60_000,
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
            /** Keep last-known data while re-fetching → no spinner flash on page switches. */
            placeholderData: keepPreviousData,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AdminToastProvider>{children}</AdminToastProvider>
    </QueryClientProvider>
  );
}
