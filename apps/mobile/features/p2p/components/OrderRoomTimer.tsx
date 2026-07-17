import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';

type Props = {
  expiresAtIso: string | null | undefined;
  active: boolean;
  onExpire?: () => void;
};

export function OrderRoomTimer({ expiresAtIso, active, onExpire }: Props) {
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const error = semanticStatusPalette(theme.colors, 'error');
  const [leftSec, setLeftSec] = useState<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
  }, [expiresAtIso, active]);

  useEffect(() => {
    if (!active || !expiresAtIso) {
      setLeftSec(null);
      return;
    }
    const end = new Date(expiresAtIso).getTime();
    const tick = () => {
      const diff = Math.floor((end - Date.now()) / 1000);
      if (diff <= 0) {
        setLeftSec(0);
        if (!fired.current) {
          fired.current = true;
          onExpire?.();
        }
        return;
      }
      setLeftSec(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso, active, onExpire]);

  if (!active || !expiresAtIso) return null;

  const m = leftSec == null ? 0 : Math.floor(leftSec / 60);
  const s = leftSec == null ? 0 : leftSec % 60;
  const urgent = leftSec != null && leftSec < 300;
  const palette = urgent ? error : warning;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: palette.border,
          backgroundColor: palette.bg,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing[3.5],
          paddingVertical: theme.spacing[2.5],
          marginBottom: theme.spacing[3],
          gap: theme.spacing[2.5],
        },
      ]}
    >
      <Ionicons name="time-outline" size={theme.sizes.iconMd} color={palette.fg} />
      <Text style={[theme.typography.bodyMd, styles.label, { color: palette.fg, fontFamily: theme.fonts.sansSemiBold }]}>
        Payment window
      </Text>
      <Text
        style={[
          theme.typography.displayMd,
          styles.time,
          { color: palette.fg, fontFamily: theme.fonts.sansBold, fontSize: 20, lineHeight: 26 },
        ]}
      >
        {leftSec == null ? '—' : `${m}:${s.toString().padStart(2, '0')}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  label: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
});
