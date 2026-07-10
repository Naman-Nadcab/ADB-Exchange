import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'qa' | 'uat' | 'production';

export type EnvConfig = {
  appEnv: AppEnvironment;
  apiUrl: string;
  wsUrl: string;
};

export function getEnvConfig(): EnvConfig {
  const extra = Constants.expoConfig?.extra as Partial<EnvConfig> | undefined;
  return {
    appEnv: (extra?.appEnv as AppEnvironment) ?? 'development',
    apiUrl: extra?.apiUrl ?? 'http://10.0.2.2:4000',
    wsUrl: extra?.wsUrl ?? 'ws://10.0.2.2:4000',
  };
}

export function getApiBaseUrl(): string {
  return `${getEnvConfig().apiUrl.replace(/\/$/, '')}/api/v1`;
}

export function getWsSpotUrl(): string {
  const base = getEnvConfig().wsUrl.replace(/\/$/, '');
  return `${base}/api/v1/spot/ws`;
}
