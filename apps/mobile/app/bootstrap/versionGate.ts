import Constants from 'expo-constants';

export type VersionGateResult = {
  forceUpdate: boolean;
  minVersion?: string;
};

/** S-001 force update gate — compares against remote min version when configured. */
export async function checkVersionGate(): Promise<VersionGateResult> {
  const minVersion = Constants.expoConfig?.extra?.minAppVersion as string | undefined;
  if (!minVersion) return { forceUpdate: false };
  const current = Constants.expoConfig?.version ?? '1.0.0';
  const forceUpdate = compareSemver(current, minVersion) < 0;
  return { forceUpdate, minVersion };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
