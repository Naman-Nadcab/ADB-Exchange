import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useMarketsMeta } from '../hooks/useTrade';
import { SpotOrderbookPanel } from '../components/SpotOrderbookPanel';
import { useTradeScreenData } from '../hooks/useTradeSubscriptions';
import { resolveSpotDisplayLastPrice } from '@core/domain/trade/spotPriceDisplay';
import { useTicker } from '@features/markets';
import type { TradeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TradeStackParamList, 'OrderbookFullscreen'>;

export function OrderbookFullscreenScreen({ route }: Props) {
  const { symbol } = route.params;
  const { orderbook, trades } = useTradeScreenData(symbol);
  const { data: ticker } = useTicker(symbol);
  const { data: markets } = useMarketsMeta();
  const marketMeta = markets?.find((m) => m.symbol === symbol);

  const lastPrice = resolveSpotDisplayLastPrice({
    tickerLast: ticker?.last_price ?? null,
    orderbook,
    recentTrades: trades,
  });

  useEffect(() => {
    analytics.screen('S-303');
  }, []);

  return (
    <ScreenLayout testID="S-303">
      <ScrollView>
        <SpotOrderbookPanel
          book={orderbook}
          recentTrades={trades ?? []}
          quoteAsset={marketMeta?.quote_asset ?? 'USDT'}
          baseAsset={marketMeta?.base_asset ?? symbol.split('_')[0]}
          lastPrice={lastPrice}
          pricePrecision={marketMeta?.price_precision ?? 8}
        />
      </ScrollView>
    </ScreenLayout>
  );
}
