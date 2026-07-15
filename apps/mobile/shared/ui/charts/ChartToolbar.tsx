import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';
import { SegmentControl } from '../layout/SegmentControl';
import type { OverlayStudyId, ChartStudiesState, ChartViewMode } from '@core/domain/trade/indicators';

export type { ChartStudiesState, ChartViewMode };

type Props = {
  viewMode: ChartViewMode;
  onViewModeChange: (mode: ChartViewMode) => void;
  studies: ChartStudiesState;
  onStudiesChange: (studies: ChartStudiesState) => void;
  streamLabel?: string;
};

const OVERLAY_OPTIONS: { id: OverlayStudyId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'sma_7', label: 'SMA 7' },
  { id: 'sma_25', label: 'SMA 25' },
  { id: 'ema_12', label: 'EMA 12' },
  { id: 'ema_26', label: 'EMA 26' },
  { id: 'vwap', label: 'VWAP' },
  { id: 'bb_20', label: 'BB 20' },
];

export function ChartToolbar({ viewMode, onViewModeChange, studies, onStudiesChange, streamLabel }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      {streamLabel ? (
        <Text style={[styles.stream, { color: `hsl(${theme.colors.foregroundSecondary})` }]} numberOfLines={1}>
          {streamLabel}
        </Text>
      ) : null}
      <SegmentControl
        tabs={[
          { id: 'candle', label: 'Candles' },
          { id: 'depth', label: 'Depth' },
        ]}
        active={viewMode}
        onChange={(id) => onViewModeChange(id as ChartViewMode)}
      />
      {viewMode === 'candle' ? (
        <>
          <SegmentControl
            tabs={OVERLAY_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            active={studies.overlay}
            onChange={(id) => onStudiesChange({ ...studies, overlay: id as OverlayStudyId })}
          />
          <View style={styles.toggles}>
            <StudyToggle
              label="RSI(14)"
              active={studies.rsi}
              onPress={() => {
                void hapticSelection();
                onStudiesChange({ ...studies, rsi: !studies.rsi });
              }}
              theme={theme}
            />
            <StudyToggle
              label="Vol SMA 9"
              active={studies.volumeSma}
              onPress={() => {
                void hapticSelection();
                onStudiesChange({ ...studies, volumeSma: !studies.volumeSma });
              }}
              theme={theme}
            />
            <StudyToggle
              label="Studies"
              active={!!studies.extStackOpen}
              onPress={() => {
                void hapticSelection();
                onStudiesChange({ ...studies, extStackOpen: !studies.extStackOpen });
              }}
              theme={theme}
            />
          </View>
          {studies.extStackOpen ? (
            <View style={styles.toggles}>
              {(
                [
                  ['ema7', 'EMA 7'],
                  ['ema20', 'EMA 20'],
                  ['ema50', 'EMA 50'],
                  ['ema200', 'EMA 200'],
                ] as const
              ).map(([key, label]) => (
                <StudyToggle
                  key={key}
                  label={label}
                  active={!!studies[key]}
                  onPress={() => {
                    void hapticSelection();
                    onStudiesChange({ ...studies, [key]: !studies[key] });
                  }}
                  theme={theme}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function StudyToggle({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? `hsl(${theme.colors.brandPrimary} / 0.4)` : `hsl(${theme.colors.borderDefault})`,
          backgroundColor: active ? `hsl(${theme.colors.brandPrimary} / 0.15)` : `hsl(${theme.colors.surfaceMuted} / 0.4)`,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: active ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  stream: { fontSize: 10, marginBottom: 4, fontFamily: 'IBMPlexMono_400Regular' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, minHeight: 34, justifyContent: 'center' },
});
