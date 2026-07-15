export const CACHE_KEYS = {
  markets: 'cache.markets',
  favorites: 'markets.favorites',
  recentMarkets: 'markets.recent',
  preferences: 'prefs.user',
  onboarding: 'prefs.onboarding',
  language: 'prefs.language',
  theme: 'prefs.theme',
  appLockEnabled: 'prefs.appLock.enabled',
  appLockTimeout: 'prefs.appLock.timeout',
  marketSort: 'markets.sort',
  quoteCurrency: 'markets.quote',
  guestMode: 'prefs.guestMode',
} as const;
