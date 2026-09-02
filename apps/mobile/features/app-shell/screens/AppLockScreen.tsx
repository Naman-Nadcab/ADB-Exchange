import { ShellStateScreen } from '../components/ShellStateScreen';
import { appLock } from '@core/security/appLock';
import { useAppStore } from '@core/state/appStore';

export function AppLockScreen() {
  const setShellGate = useAppStore((s) => s.setShellGate);

  const unlock = async () => {
    const ok = await appLock.promptUnlock();
    if (ok) setShellGate('none');
  };

  return (
    <ShellStateScreen
      testID="D-900"
      title="App Locked"
      message="Authenticate to continue using FDM."
      icon="lock-closed-outline"
      actionLabel="Unlock"
      onAction={() => void unlock()}
    />
  );
}
