export const performance = {
  mark(name: string) {
    if (__DEV__) console.log('[perf:mark]', name, Date.now());
  },
  measure(name: string, startMark: string) {
    if (__DEV__) console.log('[perf:measure]', name, 'from', startMark);
  },
};
