import { useEffect } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useSettingsPrefsStore } from '@core/state/settingsPrefsStore';
import { usePreferences, useSavePreferences } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Preferences'>;

export function PreferencesScreen(_props: Props) {
  const { colorScheme, setColorScheme } = useTheme();
  const prefs = useSettingsPrefsStore((s) => s.prefs);
  const setPrefs = useSettingsPrefsStore((s) => s.setPrefs);
  const hydrate = useSettingsPrefsStore((s) => s.hydrate);
  const serverQ = usePreferences();
  const save = useSavePreferences();

  useEffect(() => {
    analytics.screen('S-740');
    hydrate();
  }, [hydrate]);

  const notif = prefs.notifications ?? {};

  return (
    <ScreenLayout testID="S-740">
      <ScrollView>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Appearance</Text>
        <SegmentControl
          tabs={[
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
          ]}
          active={colorScheme}
          onChange={(id) => setColorScheme(id as 'light' | 'dark')}
        />
        <ToggleRow label="Price alerts" value={!!notif.price_alerts} onChange={(v) => setPrefs({ notifications: { ...notif, price_alerts: v } })} />
        <ToggleRow label="P2P alerts" value={!!notif.p2p_alerts} onChange={(v) => setPrefs({ notifications: { ...notif, p2p_alerts: v } })} />
        <ToggleRow label="Trading alerts" value={!!notif.trading_alerts} onChange={(v) => setPrefs({ notifications: { ...notif, trading_alerts: v } })} />
        <ToggleRow label="Security alerts" value={!!notif.security_alerts} onChange={(v) => setPrefs({ notifications: { ...notif, security_alerts: v } })} />
        <ToggleRow label="Sound" value={!!prefs.sound_enabled} onChange={(v) => setPrefs({ sound_enabled: v })} />
        <ToggleRow label="Haptics" value={!!prefs.haptics_enabled} onChange={(v) => setPrefs({ haptics_enabled: v })} />
        <PrimaryButton title="Sync preferences" loading={save.isPending} onPress={() => void save.mutateAsync({ ...serverQ.data, ...prefs })} />
      </ScrollView>
    </ScreenLayout>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, minHeight: 44 }}>
      <Text>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
