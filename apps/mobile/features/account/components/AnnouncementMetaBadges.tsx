import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  type?: string;
  pinned?: boolean;
};

export function AnnouncementMetaBadges({ type, pinned }: Props) {
  const { theme } = useTheme();
  if (!type && !pinned) return null;

  return (
    <View style={styles.row}>
      {type ? (
        <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
            {type}
          </Text>
        </View>
      ) : null}
      {pinned ? (
        <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '600' }}>
            Pinned
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
