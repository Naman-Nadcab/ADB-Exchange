import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Props = {
  expiresAtIso: string | null | undefined;
  active: boolean;
  onExpire?: () => void;
};

export function OrderRoomTimer({ expiresAtIso, active, onExpire }: Props) {
  const { theme } = useTheme();
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

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: urgent ? `hsl(${theme.colors.statusError} / 0.3)` : 'rgba(245,158,11,0.25)',
          backgroundColor: urgent ? `hsl(${theme.colors.statusError} / 0.06)` : 'rgba(245,158,11,0.06)',
        },
      ]}
    >
      <Ionicons name="time-outline" size={18} color={urgent ? `hsl(${theme.colors.statusError})` : '#f59e0b'} />
      <Text style={[styles.label, { color: urgent ? `hsl(${theme.colors.statusError})` : '#f59e0b' }]}>
        Payment window
      </Text>
      <Text
        style={[
          styles.time,
          { color: urgent ? `hsl(${theme.colors.statusError})` : '#f59e0b' },
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
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  label: { fontSize: 14, fontWeight: '600', flex: 1 },
  time: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
