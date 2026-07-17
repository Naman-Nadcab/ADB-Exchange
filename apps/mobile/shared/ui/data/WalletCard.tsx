import { Text } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '../layout/ExchangeCard';
import { PriceLabel } from './PriceLabel';

type Props = {
  title: string;
  totalBalance: number;
  currency: string;
  pnl?: number;
  pnlPct?: number;
  testID?: string;
};

export function WalletCard({ title, totalBalance, currency, pnl, pnlPct, testID }: Props) {
  const { theme } = useTheme();
  const pnlUp = (pnl ?? 0) >= 0;

  return (
    <ExchangeCard testID={testID} elevated style={{ marginBottom: theme.spacing[4] }}>
      <Text
        style={[
          theme.typography.labelMd,
          { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2] },
        ]}
      >
        {title}
      </Text>
      <PriceLabel value={totalBalance} currency={currency} size="lg" />
      {pnl != null && pnlPct != null ? (
        <Text
          style={[
            theme.typography.price,
            {
              marginTop: theme.spacing[2],
              color: `hsl(${pnlUp ? theme.colors.tradeBuy : theme.colors.tradeSell})`,
            },
          ]}
        >
          {pnlUp ? '+' : ''}
          {pnl.toFixed(2)} ({pnlUp ? '+' : ''}
          {pnlPct.toFixed(2)}%)
        </Text>
      ) : null}
    </ExchangeCard>
  );
}
