import { reportApiService } from "@/services/report-api";
import { syncReportsFromServer } from "@/lib/db";
import {
  SYNC_DEFAULT_LOOKBACK_DAYS,
  SYNC_FULL_LOOKBACK_DAYS,
  SYNC_OVERLAP_MS,
} from "@/lib/constants";

export const SYNC_KEY = "kolayrapor_lastSyncedAt";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - "full": son SYNC_FULL_LOOKBACK_DAYS günü baştan çeker (uygulama açılışı,
 *   "Senkronize Et" butonu).
 * - "incremental": lastSyncedAt − SYNC_OVERLAP_MS'ten itibaren çeker; hiç
 *   senkron yapılmamışsa SYNC_DEFAULT_LOOKBACK_DAYS'e düşer.
 */
export type SyncMode = "full" | "incremental";

function getSince(mode: SyncMode): string {
  if (mode === "full") {
    return new Date(Date.now() - SYNC_FULL_LOOKBACK_DAYS * DAY_MS).toISOString();
  }
  const lastSyncedAt = localStorage.getItem(SYNC_KEY);
  return lastSyncedAt
    ? new Date(new Date(lastSyncedAt).getTime() - SYNC_OVERLAP_MS).toISOString()
    : new Date(Date.now() - SYNC_DEFAULT_LOOKBACK_DAYS * DAY_MS).toISOString();
}

/** Raporları sunucudan çekip Dexie'ye yazar; yeni/güncellenen kayıt sayısını
 *  döner. Hata fırlatırsa lastSyncedAt güncellenmez. */
export async function runReportSync(mode: SyncMode): Promise<number> {
  const reports = await reportApiService.getMyReports(getSince(mode));
  const synced =
    reports.length > 0 ? await syncReportsFromServer(reports) : 0;
  localStorage.setItem(SYNC_KEY, new Date().toISOString());
  return synced;
}
