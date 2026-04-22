export const API_BASE_URL = "https://api.kolayrapor.com.tr/api"
//export const API_BASE_URL = "http://localhost:3000/api";

/** Base URL for the marketing/landing site (used for embedded registration form, etc.) */
export const LANDING_BASE_URL =
  (import.meta.env.VITE_LANDING_BASE_URL as string | undefined) ??
  "https://kolayrapor.com.tr";

/** Default sync lookback period in days (used on first sync when no lastSyncedAt exists) */
export const SYNC_DEFAULT_LOOKBACK_DAYS = 90;
