import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { sessionManager } from '@core/auth/sessionManager';
import { useAuthStore } from '@core/state/authStore';
import { getWalletConnectProjectId } from '@core/config/walletConnect';
import { DeeplinkWalletConnector } from '@core/wallet-auth/connector';
import { createLinkingTransport } from '@core/wallet-auth/linkingTransport';
import { authenticateMobileWallet } from '@core/wallet-auth/flow';
import { PHASE_COPY } from '@core/wallet-auth/copy';
import type { MobileWalletPhase, WalletProviderId } from '@core/wallet-auth/types';
import { useAuthActions } from './useAuthActions';

export function useWalletLogin() {
  const [phase, setPhase] = useState<MobileWalletPhase>('IDLE');
  const [providerId, setProviderId] = useState<WalletProviderId | null>(null);
  const connectorRef = useRef<DeeplinkWalletConnector | null>(null);
  const aliveRef = useRef(true);
  const runningRef = useRef(false);
  const { completeSession } = useAuthActions();

  useEffect(() => {
    aliveRef.current = true;
    const connector = new DeeplinkWalletConnector(createLinkingTransport(), {
      projectId: getWalletConnectProjectId() || null,
    });
    connector.start();
    connectorRef.current = connector;
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active' || next === 'background' || next === 'inactive') {
        connector.handleAppState(next);
      }
    });
    return () => {
      appState.remove();
      aliveRef.current = false;
      connector.cancelPending();
      connector.disconnect();
      connector.stop();
      connectorRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    const connector = connectorRef.current;
    if (!connector || !providerId || runningRef.current) return;
    runningRef.current = true;
    try {
      setPhase('CONNECTING');
      const result = await authenticateMobileWallet({
        connect: (report) => connector.connect(providerId, report),
        getAccount: () => connector.getAccount(),
        signMessage: (message, report) => connector.signMessage(message, report),
        watch: (onChange) => connector.watch(onChange),
        requestChallenge: async (caip10) => {
          const challenge = await getAuthRepository().walletChallenge(caip10);
          return { id: challenge.id, message: challenge.message };
        },
        login: (body) => getAuthRepository().walletLogin(body),
        onPhase: (next) => {
          if (aliveRef.current) setPhase(next);
        },
      });
      if (!result.ok) {
        if (aliveRef.current) setPhase(result.restart ? 'CHALLENGE_EXPIRED' : result.code);
        return;
      }
      await completeSession(result.session);
      try {
        const me = await getAuthRepository().getMe();
        if (me.id === result.session.user.id) {
          useAuthStore.getState().setAuthenticated(me, result.session.accessToken, result.session.refreshToken);
          await sessionManager.saveSession(
            { accessToken: result.session.accessToken, refreshToken: result.session.refreshToken },
            me,
          );
        }
      } catch {
        // The login response already opened the application session.
        // The next launch hydrates it through /auth/me.
      }
      if (aliveRef.current) setPhase('SUCCESS');
    } finally {
      runningRef.current = false;
    }
  }, [completeSession, providerId]);

  const disconnectWallet = useCallback(() => {
    connectorRef.current?.disconnect();
  }, []);

  return {
    phase,
    providerId,
    setProviderId,
    start,
    disconnectWallet,
    statusText: PHASE_COPY[phase],
  };
}
