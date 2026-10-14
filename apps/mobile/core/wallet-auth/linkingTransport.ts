import { Linking } from 'react-native';
import type { WalletTransport } from './connector';

export function createLinkingTransport(): WalletTransport {
  return {
    canOpen: async (url) => {
      try {
        return await Linking.canOpenURL(url);
      } catch {
        return false;
      }
    },
    open: (url) => Linking.openURL(url),
    subscribe: (listener) => {
      const subscription = Linking.addEventListener('url', (event) => {
        listener(event.url);
      });
      void Linking.getInitialURL()
        .then((url) => {
          if (url) listener(url);
        })
        .catch(() => undefined);
      return () => subscription.remove();
    },
    createRequestId: () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}
