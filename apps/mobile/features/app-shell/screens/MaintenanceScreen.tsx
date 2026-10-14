import { ShellStateScreen } from '../components/ShellStateScreen';

export function MaintenanceScreen() {
  return (
    <ShellStateScreen
      testID="S-002"
      title="Maintenance"
      message="ADB Exchange is temporarily unavailable. Please try again later."
      icon="construct-outline"
    />
  );
}
