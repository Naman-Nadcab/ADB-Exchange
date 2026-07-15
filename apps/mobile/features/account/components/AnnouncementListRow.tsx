import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import {
  formatAnnouncementListDate,
  isAnnouncementNew,
} from '@core/domain/announcements/announcements';
import type { Announcement } from '@exchange/mobile-types';

type Props = {
  item: Announcement;
  onPress: () => void;
};

export function AnnouncementListRow({ item, onPress }: Props) {
  const { theme } = useTheme();
  const isNew = isAnnouncementNew(item);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
        },
      ]}
    >
      <View style={styles.left}>
        {isNew ? (
          <View style={[styles.newBadge, { backgroundColor: `hsl(${theme.colors.tradeSell})` }]}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
          {formatAnnouncementListDate(item)}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontWeight: '600', fontSize: 15 },
  newBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});
