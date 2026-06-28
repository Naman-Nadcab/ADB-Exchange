/** Baked at build time — mirrors backend ADMIN_2FA_MANDATORY. */
export const ADMIN_LOGIN_2FA_REQUIRED =
  process.env.NEXT_PUBLIC_ADMIN_2FA_REQUIRED === 'true';
