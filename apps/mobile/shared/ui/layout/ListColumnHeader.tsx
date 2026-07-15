import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  columns: { label: string; flex?: number; align?: 'left' | 'right' | 'center' }[];
};

export function ListColumnHeader({ columns }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
      {columns.map((col) => (
        <Text
          key={col.label}
          style={[
            styles.label,
            {
              flex: col.flex ?? 1,
              textAlign: col.align ?? 'left',
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansMedium,
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
