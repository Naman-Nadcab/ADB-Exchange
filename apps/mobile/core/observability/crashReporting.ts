/** Crash reporting abstraction — Sentry wired Sprint 1+. */
export const crashReporting = {
  init() {
    // no-op Sprint 0
  },
  captureException(error: unknown) {
    if (__DEV__) console.error('[crash]', error);
  },
};
