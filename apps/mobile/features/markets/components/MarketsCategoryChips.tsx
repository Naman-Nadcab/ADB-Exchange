import { ScrollView, StyleSheet } from 'react-native';
import { FilterChip } from '@shared/ui';
import { hapticSelection } from '@shared/theme';
import type { MarketSector } from '@core/domain/markets/sectors';
import { SECTOR_LABELS } from '@core/domain/markets/sectors';

const SECTORS: (MarketSector | null)[] = [null, 'Layer1', 'Layer2', 'AI', 'Meme', 'Gaming', 'RWA', 'DePIN'];

type Props = {
  active: MarketSector | null;
  onChange: (sector: MarketSector | null) => void;
};

export function MarketsCategoryChips({ active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {SECTORS.map((sector) => (
        <FilterChip
          key={sector ?? 'all'}
          label={sector ? SECTOR_LABELS[sector] : 'All Categories'}
          selected={active === sector}
          onPress={() => {
            void hapticSelection();
            onChange(sector);
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 8 },
  content: { gap: 8, paddingRight: 8 },
});
