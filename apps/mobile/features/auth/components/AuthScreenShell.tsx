import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@shared/theme';
import { ScreenLayout, TopAppBar } from '@shared/ui';

type Props = {
  children: React.ReactNode;
  testID?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  footer?: React.ReactNode;
};

/** Shared auth/onboarding shell — terminal shell gradient from web globals.css */
export function AuthScreenShell({ children, testID, title, subtitle, onBack, footer }: Props) {
  const { theme } = useTheme();
  const isDark = theme.scheme === 'dark';

  return (
    <ScreenLayout testID={testID} scroll keyboard edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient
        colors={
          isDark
            ? [`hsl(${theme.colors.backgroundPanel} / 0.32)`, `hsl(${theme.colors.backgroundPrimary})`]
            : [`hsl(${theme.colors.backgroundElevated})`, `hsl(${theme.colors.backgroundPrimary})`]
        }
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {onBack ? <TopAppBar onBack={onBack} transparent /> : null}
      <View style={[styles.header, { marginTop: onBack ? theme.spacing[2] : theme.spacing[6] }]}>
        {title ? (
          <Text style={[theme.typography.displayMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {title}
          </Text>
        ) : (
          <Text style={[theme.typography.displayMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            METHErium
          </Text>
        )}
        {subtitle ? (
          <Text
            style={[
              theme.typography.bodyLg,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[2] },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={[styles.footer, { marginTop: theme.spacing[6] }]}>{footer}</View> : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  body: { flex: 1 },
  footer: { gap: 12 },
});
