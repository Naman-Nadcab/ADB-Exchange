import { View, Text, StyleSheet } from 'react-native';
import { StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';

type Props = {
  type?: string;
  pinned?: boolean;
};

export function AnnouncementMetaBadges({ type, pinned }: Props) {
  const { theme } = useTheme();
  if (!type && !pinned) return null;

  return (
    <View style={[styles.row, { gap: theme.spacing[2], marginBottom: theme.spacing[2] }]}>
      {type ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
              borderRadius: theme.radius.sm + 2,
              paddingHorizontal: theme.spacing[2],
              paddingVertical: theme.spacing[1],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansSemiBold,
                textTransform: 'capitalize',
              },
            ]}
          >
            {type}
          </Text>
        </View>
      ) : null}
      {pinned ? <StatusChip label="Pinned" tone="sync" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: {},
});
