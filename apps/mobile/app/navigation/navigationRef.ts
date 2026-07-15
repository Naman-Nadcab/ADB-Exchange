import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function resetRoot(route: keyof RootStackParamList) {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({ index: 0, routes: [{ name: route }] });
}

export function openAuthScreen(screen: string, params?: object) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Auth', { screen, params } as never);
}

export function dismissAuthModal() {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  const current = state.routes[state.index];
  if (current?.name === 'Auth') {
    navigationRef.goBack();
  }
}

export function isAuthModalVisible(): boolean {
  if (!navigationRef.isReady()) return false;
  const state = navigationRef.getRootState();
  return state.routes[state.index]?.name === 'Auth';
}
