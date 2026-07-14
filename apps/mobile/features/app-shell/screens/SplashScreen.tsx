import { ShellStateScreen } from '../components/ShellStateScreen';

export function SplashScreen() {
  return (
    <ShellStateScreen
      testID="S-000"
      title="METHErium"
      message="Loading your trading experience…"
      icon="pulse-outline"
      loading
    />
  );
}
