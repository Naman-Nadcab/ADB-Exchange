export type KycStatus = {
  id?: string;
  status: string;
  kycLevel?: number;
  kyc_level?: number;
  verified: boolean;
  submittedAt?: string;
  submitted_at?: string;
  reviewedAt?: string;
  reviewed_at?: string;
  rejectionReason?: string;
  rejection_reason?: string;
};

export type InitiateKycRequest = {
  country: string;
  documentType: string;
  provider?: string;
};
