import { ShellStateScreen } from '../components/ShellStateScreen';

export function SanctionsBlockedScreen() {
  return (
    <ShellStateScreen
      testID="S-004"
      title="Access Restricted"
      message="FDM is not available in your region due to compliance requirements."
      icon="globe-outline"
    />
  );
}
