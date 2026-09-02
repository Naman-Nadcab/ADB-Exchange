import { Linking } from 'react-native';
import { ShellStateScreen } from '../components/ShellStateScreen';

export function ForceUpdateScreen() {
  return (
    <ShellStateScreen
      testID="S-001"
      title="Update Required"
      message="A new version of FDM is required to continue."
      icon="arrow-up-circle-outline"
      actionLabel="Open App Store"
      onAction={() => Linking.openURL('https://app.metheorium.com')}
    />
  );
}
