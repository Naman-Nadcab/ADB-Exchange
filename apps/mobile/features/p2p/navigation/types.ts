export type P2PStackParamList = {
  Marketplace: undefined;
  AdDetail: { adId: string };
  CreateOrder: { adId: string };
  PostAdType: undefined;
  PostAdPrice: undefined;
  PostAdPayment: undefined;
  PostAdReview: undefined;
  MyAds: undefined;
  EditAd: { adId: string };
  OrdersList: undefined;
  OrderRoom: { orderId: string };
  PaymentMethods: undefined;
  AddPaymentMethod: { id?: string };
  MerchantDashboard: undefined;
  MerchantProfile: { advertiserId: string };
  DisputeDetail: { disputeId: string };
  BlockedAdvertisers: undefined;
};
