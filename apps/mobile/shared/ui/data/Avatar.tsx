import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  name?: string;
  uri?: string;
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
};

export function Avatar({ name, uri, size = 'md', testID }: Props) {
  const { theme } = useTheme();
  const dim = size === 'sm' ? theme.sizes.avatarSm : size === 'lg' ? theme.sizes.avatarLg : theme.sizes.avatarMd;
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.18)`,
          borderColor: `hsl(${theme.colors.borderDefault})`,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: dim, height: dim, borderRadius: dim / 2 }} />
      ) : (
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.brandPrimary})`, fontSize: dim * 0.38 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
});
