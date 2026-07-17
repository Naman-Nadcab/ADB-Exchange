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
    <View testID={testID} style={[styles.wrap, { paddingVertical: theme.spacing.pageY }]}>
      <View
        style={[
          styles.iconWrap,
          {
            width: theme.sizes.iconLg + theme.spacing[6],
            height: theme.sizes.iconLg + theme.spacing[6],
            borderRadius: theme.radius.full,
            backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
            marginBottom: theme.spacing[2],
          },
        ]}
      >
        <Ionicons name={icon} size={theme.sizes.iconLg - 4} color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
      <EmptyState title={title} message={message} />
      <PrimaryButton title="Log In" size="xl" onPress={() => openLogin()} />
      <PrimaryButton
        title="Register"
        variant="outline"
        size="xl"
        onPress={() => openSignup()}
        style={{ marginTop: theme.spacing[3] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
