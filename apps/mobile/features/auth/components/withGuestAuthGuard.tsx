import type { ComponentType } from 'react';
import { ScreenLayout } from '@shared/ui';
import { GuestAuthPrompt } from './GuestAuthPrompt';
import { useGuestAccess } from '../hooks/useGuestAccess';

type GuardOpts = {
  title?: string;
  message?: string;
  testID?: string;
};

export function withGuestAuthGuard<P extends object>(
  Wrapped: ComponentType<P>,
  opts?: GuardOpts,
) {
  function GuestGuardedScreen(props: P) {
    const { isGuest } = useGuestAccess();
    if (isGuest) {
      return (
        <ScreenLayout testID={opts?.testID}>
          <GuestAuthPrompt
            title={opts?.title ?? 'Sign in required'}
            message={opts?.message ?? 'Log in to access this feature.'}
          />
        </ScreenLayout>
      );
    }
    return <Wrapped {...props} />;
  }
  GuestGuardedScreen.displayName = `GuestGuard(${Wrapped.displayName ?? Wrapped.name ?? 'Screen'})`;
  return GuestGuardedScreen;
}

/** Shorthand for stack navigators. */
export function guestGuard<P extends object>(
  Wrapped: ComponentType<P>,
  message: string,
  testID?: string,
): ComponentType<P> {
  return withGuestAuthGuard(Wrapped, { message, testID }) as ComponentType<P>;
}
