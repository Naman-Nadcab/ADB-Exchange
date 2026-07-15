import { Pressable, View, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticSelection } from '@shared/theme';

const TERMS_URL = 'https://app.metheorium.com/terms';
const PRIVACY_URL = 'https://app.metheorium.com/privacy';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AuthTermsCheckbox({ checked, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => {
        void hapticSelection();
        onChange(!checked);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: `hsl(${theme.colors.borderDefault})`,
        backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
        opacity: 0.85,
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={{
          marginTop: 2,
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: `hsl(${theme.colors.borderDefault})`,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? `hsl(${theme.colors.brandPrimary})` : 'transparent',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={12} color={`hsl(${theme.colors.brandPrimaryForeground})`} /> : null}
      </View>
      <Text style={[theme.typography.bodyMd, { flex: 1, color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        I agree to{' '}
        <Text
          onPress={() => void Linking.openURL(TERMS_URL)}
          style={{ color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }}
        >
          Terms
        </Text>{' '}
        and{' '}
        <Text
          onPress={() => void Linking.openURL(PRIVACY_URL)}
          style={{ color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansMedium }}
        >
          Privacy Policy
        </Text>
      </Text>
    </Pressable>
  );
}
