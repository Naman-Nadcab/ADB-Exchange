import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, StatusChip, Loader } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { getPublicRepository } from '@core/repositories/PublicRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SystemStatus'>;

function healthTone(status: string): StatusChipTone {
  const s = status.toLowerCase();
  if (s.includes('ok') || s.includes('healthy') || s.includes('up')) return 'live';
  if (s.includes('degrad') || s.includes('warn')) return 'warn';
  if (s.includes('down') || s.includes('error')) return 'off';
  return 'sync';
}

export function SystemStatusScreen(_props: Props) {
  const { theme } = useTheme();
  const [status, setStatus] = useState('checking…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.screen('S-791');
    void getPublicRepository()
      .getHealth()
      .then((h) => setStatus(h.status))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenLayout testID="S-791">
      <ExchangeCard elevated>
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[4] }]}>
          System status
        </Text>
        {loading ? (
          <Loader size="md" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>API status</Text>
            <StatusChip label={status} tone={healthTone(status)} pulse={status === 'checking…'} />
          </View>
        )}
      </ExchangeCard>
    </ScreenLayout>
  );
}
