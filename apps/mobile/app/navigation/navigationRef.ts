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
