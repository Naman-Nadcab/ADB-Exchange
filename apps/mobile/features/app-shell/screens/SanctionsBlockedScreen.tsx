import { ShellStateScreen } from '../components/ShellStateScreen';

export function SanctionsBlockedScreen() {
  return (
    <ShellStateScreen
      testID="S-004"
      title="Access Restricted"
      message="ADB Exchange is not available in your region because of compliance requirements."
      icon="globe-outline"
    />
  );
}
