export type AnalyticsEvent = {
  name: string;
  properties?: Record<string, string | number | boolean>;
};

/** Analytics abstraction — no provider connected Sprint 0. */
export const analytics = {
  track(event: AnalyticsEvent) {
    if (__DEV__) {
      console.log('[analytics]', event.name, event.properties ?? {});
    }
  },
  screen(screenId: string) {
    analytics.track({ name: `screen_view_${screenId.replace(/-/g, '_')}` });
  },
};
