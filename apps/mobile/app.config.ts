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
    name: 'METHErium',
    slug: 'metheorium-mobile',
    scheme: 'metheorium',
    extra: {
      appEnv: APP_ENV,
      apiUrl: env.apiUrl,
      wsUrl: env.wsUrl,
      certPreview: process.env.EXPO_PUBLIC_CERT_PREVIEW ?? '0',
      authPreview: process.env.EXPO_PUBLIC_AUTH_PREVIEW ?? '0',
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
          'METHErium uses Face ID to unlock the app and protect your account.',
        NSCameraUsageDescription:
          'METHErium uses the camera for identity verification (KYC) when you choose to verify.',
        NSPhotoLibraryUsageDescription:
          'METHErium uses your photo library to update your profile avatar.',
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
