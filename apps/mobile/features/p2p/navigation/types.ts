import type { P2PAd } from '@exchange/mobile-types';

export type P2PStackParamList = {
  Marketplace: undefined;
  AdDetail: { adId: string; ad?: P2PAd };
  CreateOrder: { adId: string };
  PostAdType: undefined;
  PostAdPrice: undefined;
  PostAdPayment: undefined;
  PostAdReview: undefined;
  MyAds: undefined;
  EditAd: { adId: string; ad?: P2PAd };
  OrdersList: undefined;
  OrderRoom: { orderId: string };
  PaymentMethods: undefined;
  AddPaymentMethod: { id?: string };
  MerchantDashboard: undefined;
  MerchantProfile: { advertiserId: string };
  DisputeDetail: { disputeId: string };
  BlockedAdvertisers: undefined;
};
