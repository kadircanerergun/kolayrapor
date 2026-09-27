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

/** How often to re-check registration while the pharmacy still looks pending.
 *  Registering through the KolayAsistan form usually activates the account
 *  right away, so this mostly runs for a tick or two before the app catches up. */
export const PENDING_RECHECK_INTERVAL_MS = 15 * 1000;

/**
 * Local captcha solver (offline EasyOCR binary) download config.
 *
 * The artifact is the PyInstaller one-folder build of `captcha-solve/solver.spec`
 * for win64, zipped so the archive contains a top-level `captcha-solver/` folder
 * (i.e. `captcha-solver/captcha-solver.exe` + `captcha-solver/_internal/...`).
 *
 * Bump CAPTCHA_SOLVER_VERSION whenever a new binary is published — clients keyed
 * off a different version directory will re-download on next launch.
 */
export const CAPTCHA_SOLVER_VERSION = "1.0.0";

/** CDN URL of the win64 captcha-solver zip (Cloudflare R2 `files` bucket, served
 *  via kolayasistan.uk — same origin as the release feed). Override per-env via
 *  VITE_CAPTCHA_SOLVER_URL. */
export const CAPTCHA_SOLVER_DOWNLOAD_URL =
  (import.meta.env.VITE_CAPTCHA_SOLVER_URL as string | undefined) ??
  `https://kolayasistan.uk/kolay-rapor/libs/captcha-solver-win64-${CAPTCHA_SOLVER_VERSION}.zip`;

/** Path of the solver executable inside the extracted version directory. */
export const CAPTCHA_SOLVER_EXE_RELPATH = "captcha-solver/captcha-solver.exe";
