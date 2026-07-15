import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import { getAppRootUrl } from '../config/env';
import type { PlatformMetrics } from '@exchange/mobile-types';

export type HealthResponse = {
  status: string;
  maintenance?: boolean;
};

export type CompliancePolicy = {
  sanctionsBlocked?: boolean;
  message?: string;
};

export type DepthPreview = {
  bids: number[];
  asks: number[];
};

export class PublicRepository extends BaseRepository {
  getHealth() {
    return this.http.request<HealthResponse>('/health', {
      method: 'GET',
      skipAuth: true,
      baseUrl: getAppRootUrl(),
    });
  }

  getCompliancePolicy() {
    return this.http.request<CompliancePolicy>('/public/compliance-policy', {
      method: 'GET',
      skipAuth: true,
    });
  }

  getPlatformMetrics() {
    return this.http.request<PlatformMetrics>('/public/platform-metrics', {
      method: 'GET',
      skipAuth: true,
    });
  }

  getHomeSparkline(symbol: string) {
    return this.http.request<{ closes: number[] }>(
      `/public/home-sparkline/${encodeURIComponent(symbol)}`,
      { method: 'GET', skipAuth: true },
    );
  }

  getDepthPreview(symbol: string) {
    return this.http.request<DepthPreview>(
      `/public/depth-preview/${encodeURIComponent(symbol)}`,
      { method: 'GET', skipAuth: true },
    );
  }
}

let publicRepository: PublicRepository | null = null;

export function getPublicRepository(): PublicRepository {
  if (!publicRepository) {
    publicRepository = new PublicRepository(getHttpClient());
  }
  return publicRepository;
}
