import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';

export type HealthResponse = {
  status: string;
  maintenance?: boolean;
};

export type CompliancePolicy = {
  sanctionsBlocked?: boolean;
  message?: string;
};

export class PublicRepository extends BaseRepository {
  getHealth() {
    return this.http.request<HealthResponse>('/health', { method: 'GET', skipAuth: true });
  }

  getCompliancePolicy() {
    return this.http.request<CompliancePolicy>('/public/compliance-policy', {
      method: 'GET',
      skipAuth: true,
    });
  }
}

let publicRepository: PublicRepository | null = null;

export function getPublicRepository(): PublicRepository {
  if (!publicRepository) {
    publicRepository = new PublicRepository(getHttpClient());
  }
  return publicRepository;
}
