export const API_BASE_URL = "https://api.kolayrapor.com.tr/api"
//export const API_BASE_URL = "http://localhost:3000/api";

/** Base URL for the marketing/landing site (used for embedded registration form, etc.) */
export const LANDING_BASE_URL =
  (import.meta.env.VITE_LANDING_BASE_URL as string | undefined) ??
  "https://kolayrapor.com.tr";

/** Default sync lookback period in days (used on first sync when no lastSyncedAt exists) */
export const SYNC_DEFAULT_LOOKBACK_DAYS = 90;

/** Periodic report sync interval in milliseconds (while the app is open) */
export const SYNC_INTERVAL_MS = 10 * 60 * 1000;

/** Buffer subtracted from lastSyncedAt to catch any reports created server-side
 *  during or just before the previous sync window. */
export const SYNC_OVERLAP_MS = 6 * 60 * 60 * 1000;
