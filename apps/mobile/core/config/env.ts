import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'qa' | 'uat' | 'production';

function defaultDevApiHost(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
}

export type EnvConfig = {
  appEnv: AppEnvironment;
  apiUrl: string;
  wsUrl: string;
};

export function getEnvConfig(): EnvConfig {
  const extra = Constants.expoConfig?.extra as Partial<EnvConfig> | undefined;
  return {
    appEnv: (extra?.appEnv as AppEnvironment) ?? 'development',
    apiUrl: extra?.apiUrl ?? defaultDevApiHost(),
    wsUrl: extra?.wsUrl ?? defaultDevApiHost().replace(/^http/, 'ws'),
  };
}

export function getAppRootUrl(): string {
  return getEnvConfig().apiUrl.replace(/\/$/, '');
}
export function getApiBaseUrl(): string {
  return `${getAppRootUrl()}/api/v1`;
}

export function getWsSpotUrl(): string {
  const base = getEnvConfig().wsUrl.replace(/\/$/, '');
  return `${base}/api/v1/spot/ws`;
}
