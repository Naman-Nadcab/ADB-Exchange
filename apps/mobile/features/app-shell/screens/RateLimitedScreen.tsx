import { ShellStateScreen } from '../components/ShellStateScreen';
import { useAppStore } from '@core/state/appStore';

export function RateLimitedScreen() {
  const setShellGate = useAppStore((s) => s.setShellGate);

  return (
    <ShellStateScreen
      testID="S-007"
      title="Rate Limited"
      message="Too many requests. Please wait and try again."
      icon="timer-outline"
      actionLabel="OK"
      onAction={() => setShellGate('none')}
    />
  );
}
