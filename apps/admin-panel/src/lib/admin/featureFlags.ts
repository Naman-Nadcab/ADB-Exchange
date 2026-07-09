/**
 * Admin feature flags — simple env-based flags for progressive feature rollout.
 * Flags can be toggled via env vars or the admin settings/feature-flags API.
 */

export const ADMIN_FEATURE_FLAGS = {
  ADMIN_NEW_DASHBOARD: true,
  ADMIN_NEW_DASHBOARD_V2_INTELLIGENCE: false,
  /** Session Zustand incident banner/prompt — disabled; backend /monitoring/incidents is sole source. */
  ADMIN_INCIDENT_MANAGEMENT: false,
  /** Session Zustand incident workspace — disabled under production hardening. */
  ADMIN_INCIDENT_SYSTEM: false,
  /** Client-side predictive alerts — disabled; backend monitoring is sole source of truth. */
  ADMIN_AI_OPS: false,
  ADMIN_PRODUCTION_HARDENING: true,
} as const;

export type AdminFeatureFlag = keyof typeof ADMIN_FEATURE_FLAGS;

export function isFeatureEnabled(flag: AdminFeatureFlag): boolean {
  return ADMIN_FEATURE_FLAGS[flag] ?? false;
}
