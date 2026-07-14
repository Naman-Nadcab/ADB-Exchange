import { View, Text } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  title: string;
  subtitle?: string;
};

export function AuthFormHeading({ title, subtitle }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing[6] }}>
      <Text
        style={[
          theme.typography.headingLg,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            theme.typography.bodyMd,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
