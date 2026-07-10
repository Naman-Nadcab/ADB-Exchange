import type { HttpClient } from '../api/httpClient';

/** Base repository — shared HTTP helpers for Sprint 1+. */
export abstract class BaseRepository {
  constructor(protected readonly http: HttpClient) {}
}
