import { ShellStateScreen } from '../components/ShellStateScreen';

export function AccountRestrictedScreen() {
  return (
    <ShellStateScreen
      testID="S-005"
      title="Account Restricted"
      message="Your account has limited access. Contact support for assistance."
      icon="shield-outline"
    />
  );
}
