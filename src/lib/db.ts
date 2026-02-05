import Dexie, { type EntityTable, type Table } from "dexie";
import type { Recete } from "@/types/recete";
import type { ReceteReportResponse } from "@/services/report-api";

interface CachedRecete extends Recete {
  cachedAt: number;
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

// --- Clear all ---

export async function clearCache(): Promise<void> {
  await db.receteDetaylar.clear();
  await db.analizSonuclari.clear();
}

export { db };
