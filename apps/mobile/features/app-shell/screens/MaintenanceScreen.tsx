import { ShellStateScreen } from '../components/ShellStateScreen';

export function MaintenanceScreen() {
  return (
    <ShellStateScreen
      testID="S-002"
      title="Maintenance"
      message="METHErium is temporarily unavailable. Please try again later."
      icon="construct-outline"
    />
  );
}
