import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusChip } from '@shared/ui';
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
          borderRadius: theme.radius.lg,
          padding: theme.spacing[3.5],
          gap: theme.spacing[3],
          marginBottom: theme.spacing[2],
        },
      ]}
    >
      <View style={[styles.left, { gap: theme.spacing[2] }]}>
        {isNew ? <StatusChip label="NEW" tone="live" /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              theme.typography.bodyLg,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.summary ? (
            <Text
              style={[
                theme.typography.bodyMd,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
              numberOfLines={2}
            >
              {item.summary}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.right, { gap: theme.spacing[1] }]}>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          {formatAnnouncementListDate(item)}
        </Text>
        <Ionicons name="chevron-forward" size={theme.sizes.iconXs + 2} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
