import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';

const OPEN_ORDERS_KEY = ['openOrders'] as const;

export function useCancelOpenOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => getSpotRepository().cancelOrder(orderId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: OPEN_ORDERS_KEY }),
  });
}
