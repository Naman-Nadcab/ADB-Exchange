import { Text } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from './TerminalPanel';

type Props = {
  label: string;
  available: string;
  asset: string;
  secondary?: string;
};

export function BalanceCard({ label, available, asset, secondary }: Props) {
  const { theme } = useTheme();
  return (
    <TerminalPanel subtle style={{ marginBottom: theme.spacing[3] }}>
      <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 4 }]}>
        {label}
      </Text>
      <Text
        style={[
          theme.typography.priceLg,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.monoSemiBold },
        ]}
      >
        {available}{' '}
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{asset}</Text>
      </Text>
      {secondary ? (
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }]}>
          {secondary}
        </Text>
      ) : null}
    </TerminalPanel>
  );
}
