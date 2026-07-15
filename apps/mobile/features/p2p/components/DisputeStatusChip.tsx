import { View, Text, StyleSheet } from 'react-native';
import { disputeStatusChipTone, disputeStatusLabel } from '@core/domain/p2p/dispute';

const TONE_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: 'rgba(245,158,11,0.14)', text: '#f59e0b' },
  resolved: { bg: 'rgba(14,203,129,0.14)', text: '#0ecb81' },
  closed: { bg: 'rgba(120,120,120,0.12)', text: '#888' },
  muted: { bg: 'rgba(120,120,120,0.12)', text: '#888' },
};

type Props = { status: string };

export function DisputeStatusChip({ status }: Props) {
  const tone = disputeStatusChipTone(status);
  const colors = TONE_COLORS[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{disputeStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
