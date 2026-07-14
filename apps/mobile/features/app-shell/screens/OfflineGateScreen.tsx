import { ShellStateScreen } from '../components/ShellStateScreen';
import { useAppStore } from '@core/state/appStore';
import { checkNetworkOnce } from '@core/offline/netInfo';

export function OfflineGateScreen() {
  const setOnline = useAppStore((s) => s.setOnline);
  const setShellGate = useAppStore((s) => s.setShellGate);

  const retry = () => {
    void checkNetworkOnce().then((state) => {
      setOnline(state.isConnected);
      if (state.isConnected) setShellGate('none');
    });
  };

  return (
    <ShellStateScreen
      testID="S-003"
      title="You're offline"
      message="Check your connection and try again."
      icon="cloud-offline-outline"
      actionLabel="Retry"
      onAction={retry}
    />
  );
}
