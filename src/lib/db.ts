import Dexie, { type EntityTable, type Table } from "dexie";
import type { Recete, ReceteIlac } from "@/types/recete";
import type {
  ReceteReportResponse,
  SyncedReport,
} from "@/services/report-api";

export interface CachedRecete extends Recete {
  cachedAt: number;
  /** True when this row was created from server sync only and lacks full
   *  prescription details (no patient name, no full medicine list, etc.). */
  isPartial?: boolean;
}

interface CachedAnaliz {
  receteNo: string;
  barkod: string;
  result: ReceteReportResponse;
  cachedAt: number;
}

const db = new Dexie("KolayRaporDB") as Dexie & {
  receteDetaylar: EntityTable<CachedRecete, "receteNo">;
  analizSonuclari: Table<CachedAnaliz>;
};

db.version(2).stores({
  receteDetaylar: "receteNo",
  analizSonuclari: "[receteNo+barkod], receteNo",
});

// --- Prescription detail helpers ---

export async function getCachedDetails(
  receteNos: string[],
): Promise<Record<string, Recete>> {
  if (receteNos.length === 0) return {};
  const rows = await db.receteDetaylar
    .where("receteNo")
    .anyOf(receteNos)
    .toArray();
  const map: Record<string, Recete> = {};
  for (const row of rows) {
    const { cachedAt: _, ...recete } = row;
    map[row.receteNo] = recete;
  }
  return map;
}

export async function cacheDetail(recete: Recete): Promise<void> {
  await db.receteDetaylar.put({ ...recete, cachedAt: Date.now() });
}

// --- Analysis result helpers ---

/** Load cached analysis results for given receteNos → Record<receteNo, Record<barkod, result>> */
export async function getCachedAnalysis(
  receteNos: string[],
): Promise<Record<string, Record<string, ReceteReportResponse>>> {
  if (receteNos.length === 0) return {};
  const rows = await db.analizSonuclari
    .where("receteNo")
    .anyOf(receteNos)
    .toArray();
  const map: Record<string, Record<string, ReceteReportResponse>> = {};
  for (const row of rows) {
    if (!map[row.receteNo]) map[row.receteNo] = {};
    map[row.receteNo][row.barkod] = row.result;
  }
  return map;
}

/** Save a single analysis result */
export async function cacheAnalysis(
  receteNo: string,
  barkod: string,
  result: ReceteReportResponse,
): Promise<void> {
  await db.analizSonuclari.put({ receteNo, barkod, result, cachedAt: Date.now() });
}

/** Save a batch of analysis results for one prescription */
export async function cacheAnalysisBatch(
  receteNo: string,
  sonuclar: Record<string, ReceteReportResponse>,
): Promise<void> {
  const entries = Object.entries(sonuclar).map(([barkod, result]) => ({
    receteNo,
    barkod,
    result,
    cachedAt: Date.now(),
  }));
  await db.analizSonuclari.bulkPut(entries);
}

// --- Load all cached prescriptions ---

export async function getAllCachedReceteler(): Promise<CachedRecete[]> {
  return db.receteDetaylar.orderBy("receteNo").reverse().toArray();
}

/** Get the latest analysis cachedAt per receteNo */
export async function getLatestAnalysisTimestamps(): Promise<Record<string, number>> {
  const rows = await db.analizSonuclari.toArray();
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (!map[row.receteNo] || row.cachedAt > map[row.receteNo]) {
      map[row.receteNo] = row.cachedAt;
    }
  }
  return map;
}

export async function getAllCachedAnalysis(): Promise<Record<string, Record<string, ReceteReportResponse>>> {
  const rows = await db.analizSonuclari.toArray();
  const map: Record<string, Record<string, ReceteReportResponse>> = {};
  for (const row of rows) {
    if (!map[row.receteNo]) map[row.receteNo] = {};
    map[row.receteNo][row.barkod] = row.result;
  }
  return map;
}

// --- Sync from server ---

export async function syncReportsFromServer(
  reports: SyncedReport[],
): Promise<number> {
  if (reports.length === 0) return 0;

  // Dedupe: for each [receteNo, barkod], keep only the report with the latest
  // processedAt — the server may return multiple historical entries per key.
  const latestByKey = new Map<string, SyncedReport>();
  for (const r of reports) {
    const key = `${r.receteNo}|${r.barkod}`;
    const existing = latestByKey.get(key);
    if (
      !existing ||
      new Date(r.processedAt).getTime() >
        new Date(existing.processedAt).getTime()
    ) {
      latestByKey.set(key, r);
    }
  }

  // Skip incoming reports that are older than the local cache so we don't
  // clobber a fresh local analysis with stale server data.
  const candidates = [...latestByKey.values()];
  const localRows = await db.analizSonuclari.bulkGet(
    candidates.map((r) => [r.receteNo, r.barkod] as [string, string]),
  );
  const entries: CachedAnaliz[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    const incomingAt = new Date(r.processedAt).getTime();
    const local = localRows[i];
    if (local && local.cachedAt >= incomingAt) continue;
    entries.push({
      receteNo: r.receteNo,
      barkod: r.barkod,
      result: {
        reportId: r.id,
        isValid: r.isValid,
        validityScore: r.validityScore,
        reportEvolutionDetails: r.reportEvolutionDetails,
        processedAt: r.processedAt,
        pharmacyId: "",
      },
      cachedAt: incomingAt,
    });
  }
  if (entries.length > 0) {
    await db.analizSonuclari.bulkPut(entries);
  }

  // Build/refresh partial prescription rows for receteNos we don't have a full
  // cached detail for, so synced reports surface in the prescription list and
  // the user can click Sorgula to fill in the rest.
  const byReceteNo = new Map<string, SyncedReport[]>();
  for (const r of reports) {
    const arr = byReceteNo.get(r.receteNo) ?? [];
    arr.push(r);
    byReceteNo.set(r.receteNo, arr);
  }

  const partialEntries: CachedRecete[] = [];
  for (const [receteNo, group] of byReceteNo) {
    const existing = await db.receteDetaylar.get(receteNo);
    if (existing && !existing.isPartial) continue;

    const ilacMap = new Map<string, ReceteIlac>();
    if (existing?.ilaclar) {
      for (const ilac of existing.ilaclar) ilacMap.set(ilac.barkod, ilac);
    }
    for (const sr of group) {
      if (!ilacMap.has(sr.barkod)) {
        ilacMap.set(sr.barkod, {
          barkod: sr.barkod,
          ad: sr.ilacAd ?? "",
          verilebilecegiTarih: "",
          adet: 0,
          periyot: "",
          doz: "",
          raporluMu: true,
        });
      }
    }

    partialEntries.push({
      receteNo,
      receteTarihi: existing?.receteTarihi ?? "",
      sonIslemTarihi: existing?.sonIslemTarihi ?? "",
      tesisKodu: existing?.tesisKodu ?? "",
      doktorBrans: existing?.doktorBrans ?? "",
      ad: existing?.ad ?? "",
      soyad: existing?.soyad ?? "",
      ilaclar: [...ilacMap.values()],
      cachedAt: existing?.cachedAt ?? Date.now(),
      isPartial: true,
    });
  }
  if (partialEntries.length > 0) {
    await db.receteDetaylar.bulkPut(partialEntries);
  }

  return entries.length;
}

// --- Clear all ---

export async function clearCache(): Promise<void> {
  await db.receteDetaylar.clear();
  await db.analizSonuclari.clear();
}

export { db };
