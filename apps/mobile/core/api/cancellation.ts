/** Per-request cancellation via AbortController. */

export type CancellableRequest = {
  signal: AbortSignal;
  cancel: () => void;
};

export function createCancellableRequest(timeoutMs?: number): CancellableRequest {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs !== undefined) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    signal: controller.signal,
    cancel: () => {
      if (timer) clearTimeout(timer);
      controller.abort();
    },
  };
}
