import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
};

const MARKS = [0, 25, 50, 75, 100];

export function PercentageSlider({ value, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <View style={{ marginVertical: theme.spacing[3] }}>
      <View style={[styles.track, { backgroundColor: `hsl(${theme.colors.surfaceAccent})` }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, Math.max(0, value))}%`,
              backgroundColor: `hsl(${theme.colors.brandPrimary})`,
            },
          ]}
        />
      </View>
      <View style={styles.marks}>
        {MARKS.map((mark) => (
          <Pressable
            key={mark}
            onPress={() => {
              void hapticSelection();
              onChange(mark);
            }}
            style={styles.markBtn}
            accessibilityRole="button"
            accessibilityLabel={`${mark} percent`}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    value >= mark ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.borderStrong})`,
                },
              ]}
            />
            <Text
              style={[
                theme.typography.labelSm,
                {
                  color:
                    value === mark
                      ? `hsl(${theme.colors.brandPrimary})`
                      : `hsl(${theme.colors.foregroundSecondary})`,
                  fontFamily: value === mark ? theme.fonts.sansSemiBold : theme.fonts.sans,
                },
              ]}
            >
              {mark}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  marks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  markBtn: { alignItems: 'center', minWidth: 36 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
});
