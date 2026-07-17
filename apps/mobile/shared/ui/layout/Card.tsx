import { ExchangeCard, type ExchangeCardProps } from './ExchangeCard';

type Props = Omit<ExchangeCardProps, 'variant'> & {
  elevated?: boolean;
  padded?: boolean;
};

/**
 * @deprecated Use `ExchangeCard` instead. Thin wrapper retained for backward compatibility.
 */
export function Card({ children, style, elevated, padded = true, testID }: Props) {
  return (
    <ExchangeCard testID={testID} style={style} elevated={elevated} padded={padded}>
      {children}
    </ExchangeCard>
  );
}

export type { ExchangeCardProps };
