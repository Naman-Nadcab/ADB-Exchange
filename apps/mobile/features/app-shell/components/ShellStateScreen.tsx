import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Loader, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';

type Props = {
  testID: string;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
};

export function ShellStateScreen({
  testID,
  title,
  message,
  icon = 'information-circle-outline',
  actionLabel,
  onAction,
  loading,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          paddingTop: insets.top + theme.spacing[6],
          paddingBottom: insets.bottom + theme.spacing[6],
          paddingHorizontal: theme.spacing.pageX,
          backgroundColor: theme.marketing.pageBg,
        },
      ]}
    >
      <ExchangeCard elevated style={styles.card}>
        {loading ? (
          <Loader size="lg" />
        ) : (
          <View
            style={[
              styles.iconWrap,
              {
                width: theme.sizes.iconXl + theme.spacing[4],
                height: theme.sizes.iconXl + theme.spacing[4],
                borderRadius: theme.radius.full,
                backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
                marginBottom: theme.spacing[4],
              },
            ]}
          >
            <Ionicons name={icon} size={theme.sizes.iconLg} color={`hsl(${theme.colors.brandPrimary})`} />
          </View>
        )}
        <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})`, textAlign: 'center' }]}>
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodyMd,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              textAlign: 'center',
              marginTop: theme.spacing[2],
              maxWidth: theme.spacing[12] * 6 + theme.spacing[4],
            },
          ]}
        >
          {message}
        </Text>
        {actionLabel && onAction ? (
          <View style={{ width: '100%', marginTop: theme.spacing[6] }}>
            <PrimaryButton title={actionLabel} onPress={onAction} />
          </View>
        ) : null}
      </ExchangeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
