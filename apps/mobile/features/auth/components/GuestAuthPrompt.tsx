import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, EmptyState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useGuestAccess } from '../hooks/useGuestAccess';

type Props = {
  testID?: string;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function GuestAuthPrompt({ testID, title, message, icon = 'lock-closed-outline' }: Props) {
  const { theme } = useTheme();
  const { openLogin, openSignup } = useGuestAccess();

  return (
    <View testID={testID} style={styles.wrap}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: `hsl(${theme.colors.surfaceMuted})` },
        ]}
      >
        <Ionicons name={icon} size={28} color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
      <EmptyState title={title} message={message} />
      <PrimaryButton title="Log In" size="xl" onPress={() => openLogin()} />
      <PrimaryButton title="Register" variant="outline" size="xl" onPress={() => openSignup()} style={styles.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  secondary: { marginTop: 12 },
});
