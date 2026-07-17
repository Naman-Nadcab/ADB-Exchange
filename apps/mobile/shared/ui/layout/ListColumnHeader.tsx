import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  columns: { label: string; flex?: number; align?: 'left' | 'right' | 'center' }[];
};

export function ListColumnHeader({ columns }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: `hsl(${theme.colors.borderDefault})`,
          paddingVertical: theme.spacing[2],
          paddingHorizontal: theme.spacing[1],
          marginBottom: theme.spacing[0.5],
        },
      ]}
    >
      {columns.map((col) => (
        <Text
          key={col.label}
          style={[
            theme.typography.labelSm,
            {
              flex: col.flex ?? 1,
              textAlign: col.align ?? 'left',
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansSemiBold,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            },
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
