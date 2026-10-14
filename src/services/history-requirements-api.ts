import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";

export interface HistoryRequirementEntry {
  barcode: string;
  esdegerBarcodes: string[];
}

export interface HistoryRequirements {
  ilacGecmisiGerekli: HistoryRequirementEntry[];
  raporGecmisiGerekli: HistoryRequirementEntry[];
}

export interface StoredHistoryRequirements extends HistoryRequirements {
  fetchedAt: string;
}

const STORAGE_KEY = "kolayrapor_historyRequirements";

class HistoryRequirementsApiService {
  async getHistoryRequirements(): Promise<HistoryRequirements> {
    const response = await apiClient.get<HistoryRequirements>(
      `${API_BASE_URL}/my-pharmacy/medicines/history-requirements`,
    );
    return {
      ilacGecmisiGerekli: response.data?.ilacGecmisiGerekli ?? [],
      raporGecmisiGerekli: response.data?.raporGecmisiGerekli ?? [],
    };
  }

  /** Sunucudan çekip saklanan listeyi tamamen değiştirir. Hata olursa eski
   *  liste yerinde kalır (boş listeyle ezilmez). */
  async refresh(): Promise<StoredHistoryRequirements> {
    try {
      const data = await this.getHistoryRequirements();
      const stored: StoredHistoryRequirements = {
        ...data,
        fetchedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return stored;
    } finally {
      // Main process (Playwright) listeyi reçete toplarken kullanıyor; fetch
      // başarısız olsa da son bilinen liste oraya iletilsin.
      await this.pushToMain();
    }
  }

  private async pushToMain(): Promise<void> {
    const stored = this.getStored();
    if (!stored) return;
    try {
      await getPlaywrightAPI().setHistoryRequirements({
        ilacGecmisiGerekli: stored.ilacGecmisiGerekli,
        raporGecmisiGerekli: stored.raporGecmisiGerekli,
      });
    } catch (err) {
      console.error("History requirements could not be sent to main:", err);
    }
  }

  getStored(): StoredHistoryRequirements | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredHistoryRequirements) : null;
    } catch {
      return null;
    }
  }
}

export const historyRequirementsApiService =
  new HistoryRequirementsApiService();
