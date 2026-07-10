let refreshPromise: Promise<string | null> | null = null;

export async function withRefreshMutex(
  refreshFn: () => Promise<string | null>,
): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshFn().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function resetRefreshMutex(): void {
  refreshPromise = null;
}
