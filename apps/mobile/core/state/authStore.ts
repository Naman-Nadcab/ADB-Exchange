import { create } from 'zustand';
import type { AuthUser } from '@exchange/mobile-types';

export type AuthStatus = 'idle' | 'hydrating' | 'authenticated' | 'unauthenticated';

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  authResolved: boolean;
  lastActiveAt: number;
  setHydrating: () => void;
  setAuthenticated: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setUnauthenticated: () => void;
  setAuthResolved: (resolved: boolean) => void;
  touchActivity: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'idle',
  user: null,
  accessToken: null,
  refreshToken: null,
  authResolved: false,
  lastActiveAt: Date.now(),
  setHydrating: () => set({ status: 'hydrating' }),
  setAuthenticated: (user, accessToken, refreshToken) =>
    set({
      status: 'authenticated',
      user,
      accessToken,
      refreshToken,
      authResolved: true,
      lastActiveAt: Date.now(),
    }),
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  setUser: (user) => set({ user }),
  setUnauthenticated: () =>
    set({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      refreshToken: null,
      authResolved: true,
    }),
  setAuthResolved: (authResolved) => set({ authResolved }),
  touchActivity: () => set({ lastActiveAt: Date.now() }),
}));
