import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ENV = process.env.APP_ENV ?? 'development';

const envConfig = {
  development: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000',
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'ws://127.0.0.1:4000',
  },
  qa: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://qa-api.metheorium.com',
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'wss://qa-api.metheorium.com',
  },
  uat: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://uat-api.metheorium.com',
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'wss://uat-api.metheorium.com',
  },
  production: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.metheorium.com',
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'wss://api.metheorium.com',
  },
} as const;

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = envConfig[APP_ENV as keyof typeof envConfig] ?? envConfig.development;

  return {
    ...config,
    name: 'ADB Exchange',
    slug: 'metheorium-mobile',
    scheme: 'metheorium',
    plugins: [...(config.plugins ?? []), './plugins/withWalletSchemeQueries'],
    extra: {
      appEnv: APP_ENV,
      apiUrl: env.apiUrl,
      wsUrl: env.wsUrl,
      certPreview: process.env.EXPO_PUBLIC_CERT_PREVIEW ?? '0',
      authPreview: process.env.EXPO_PUBLIC_AUTH_PREVIEW ?? '0',
      walletConnectProjectId: process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? 'metheorium-mobile-placeholder',
      },
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.metheorium.mobile',
      associatedDomains: ['applinks:app.metheorium.com'],
      infoPlist: {
        NSFaceIDUsageDescription:
          'ADB Exchange uses Face ID to unlock the app and protect your account.',
        NSCameraUsageDescription:
          'ADB Exchange uses the camera for identity verification when you choose to verify.',
        NSPhotoLibraryUsageDescription:
          'ADB Exchange uses your photo library when you update your profile photo.',
        LSApplicationQueriesSchemes: ['metamask', 'trust', 'cbwallet', 'phantom'],
      },
    },
    android: {
      ...config.android,
      package: 'com.metheorium.mobile',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'app.metheorium.com', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
