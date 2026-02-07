import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { KontrolSonucPanel } from "@/components/kontrol-sonuc-panel";
import { reportApiService } from "@/services/report-api";
import type { ReceteReportResponse } from "@/services/report-api";
import type { Recete, ReceteIlac } from "@/types/recete";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";
import {
  getCachedDetails,
  getCachedAnalysis,
  cacheDetail,
  cacheAnalysis,
} from "@/lib/db";

type Status = "waiting" | "loading" | "success" | "error";

export function DeeplinkKontrol() {
  const [status, setStatus] = useState<Status>("waiting");
  const [statusText, setStatusText] = useState("Bekleniyor...");
  const [errorMessage, setErrorMessage] = useState("");
  const [receteNo, setReceteNo] = useState("");
  const [barkodlar, setBarkodlar] = useState<string[]>([]);
  const [recete, setRecete] = useState<Recete | null>(null);
  const [results, setResults] = useState<Record<string, ReceteReportResponse>>(
    {},
  );
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);

  // Filter medicines: raporluMu=true, then by barkodlar if provided
  const filterIlaclar = useCallback(
    (ilaclar: ReceteIlac[], filterBarkodlar: string[]): ReceteIlac[] => {
      let filtered = ilaclar.filter((ilac) => ilac.raporluMu);
      if (filterBarkodlar.length > 0) {
        filtered = filtered.filter((ilac) =>
          filterBarkodlar.includes(ilac.barkod),
        );
      }
      return filtered;
    },
    [],
  );

  // Run analysis for given medicines, using cache or fetching fresh
  const analyzeIlaclar = useCallback(
    async (
      receteData: Recete,
      ilaclar: ReceteIlac[],
      forceAll = false,
      forceBarkod?: string,
    ): Promise<Record<string, ReceteReportResponse>> => {
      const collected: Record<string, ReceteReportResponse> = {};

      // Load cached analysis
      if (!forceAll) {
        const cachedAnaliz = await getCachedAnalysis([receteData.receteNo]);
        const cached = cachedAnaliz[receteData.receteNo] || {};
        for (const ilac of ilaclar) {
          if (forceBarkod && ilac.barkod === forceBarkod) continue;
          if (cached[ilac.barkod]) {
            collected[ilac.barkod] = cached[ilac.barkod];
          }
        }
      }

      // Fetch missing ones
      const toFetch = ilaclar.filter((ilac) => !collected[ilac.barkod]);
      for (let i = 0; i < toFetch.length; i++) {
        setStatusText(`Analiz ediliyor (${i + 1}/${toFetch.length})...`);
        const ilac = toFetch[i];
        const result = await reportApiService.generateReport(
          ilac.barkod,
          receteData,
        );
        if (result.success && result.data) {
          collected[ilac.barkod] = result.data;
          await cacheAnalysis(receteData.receteNo, ilac.barkod, result.data);
        }
      }

      return collected;
    },
    [],
  );

  // Fetch prescription data: cache first, then Playwright
  const fetchRecete = useCallback(
    async (
      rNo: string,
      filterBkd: string[],
    ): Promise<{
      receteData: Recete;
      ilaclar: ReceteIlac[];
    } | null> => {
      // Try cache first
      setStatusText("Önbellek kontrol ediliyor...");
      const cached = await getCachedDetails([rNo]);
      if (cached[rNo] && cached[rNo].ilaclar) {
        const receteData = cached[rNo];
        const ilaclar = filterIlaclar(receteData.ilaclar!, filterBkd);
        if (ilaclar.length > 0) {
          return { receteData, ilaclar };
        }
      }

      // Not in cache — need Playwright
      const playwrightAPI = getPlaywrightAPI();

      // Wait for Playwright to be ready AND on the SGK portal
      const MAX_WAIT = 30;
      let ready = false;
      for (let i = 0; i < MAX_WAIT; i++) {
        const isReadyResult = await playwrightAPI.isReady();
        if (!isReadyResult) {
          setStatusText("Sistem hazırlanıyor...");
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const urlResult = await playwrightAPI.getCurrentUrl();
        const currentUrl = urlResult?.currentUrl || "";
        if (currentUrl.includes("medeczane.sgk.gov.tr/eczane")) {
          ready = true;
          break;
        }
        setStatusText("Giriş yapılması bekleniyor...");
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!ready) {
        throw new Error(
          "Uygulamaya giriş yapılmamış. Lütfen önce ana uygulamadan giriş yapın.",
        );
      }

      // Search with retries
      const SEARCH_RETRIES = 5;
      let result: any = null;
      setStatusText("Reçete aranıyor...");
      for (let attempt = 0; attempt < SEARCH_RETRIES; attempt++) {
        result = await playwrightAPI.searchPrescription(rNo);
        if (result.success && result.prescriptionData) break;
        if (attempt < SEARCH_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      if (!result.success || !result.prescriptionData) {
        throw new Error(result.error || "Reçete bulunamadı.");
      }

      const receteData = result.prescriptionData as Recete;
      if (!receteData.ilaclar) {
        throw new Error("Reçete bulunamadı veya ilaç bilgisi yok.");
      }

      // Cache the prescription
      await cacheDetail(receteData);

      const ilaclar = filterIlaclar(receteData.ilaclar, filterBkd);
      if (ilaclar.length === 0) {
        throw new Error("Analiz edilecek raporlu ilaç bulunamadı.");
      }

      return { receteData, ilaclar };
    },
    [filterIlaclar],
  );

  // Re-analyze handler
  const handleReAnalyze = useCallback(
    async (forceBarkod?: string) => {
      if (!recete || !recete.ilaclar) return;
      setIsReAnalyzing(true);
      try {
        const ilaclar = filterIlaclar(recete.ilaclar, barkodlar);
        const collected = await analyzeIlaclar(
          recete,
          ilaclar,
          !forceBarkod,
          forceBarkod,
        );
        if (Object.keys(collected).length > 0) {
          setResults(collected);
        }
      } finally {
        setIsReAnalyzing(false);
      }
    },
    [recete, barkodlar, filterIlaclar, analyzeIlaclar],
  );

  useEffect(() => {
    const deeplinkAPI = (window as any).deeplinkAPI;
    if (!deeplinkAPI) return;

    deeplinkAPI.onParams(
      async (params: { receteNo: string; barkodlar: string[] }) => {
        setReceteNo(params.receteNo);
        setBarkodlar(params.barkodlar);
        setStatus("loading");

        try {
          const fetched = await fetchRecete(
            params.receteNo,
            params.barkodlar,
          );
          if (!fetched) {
            setStatus("error");
            setErrorMessage("Reçete bulunamadı.");
            return;
          }

          setRecete(fetched.receteData);

          // Analyze (cache-first)
          const collected = await analyzeIlaclar(
            fetched.receteData,
            fetched.ilaclar,
          );

          if (Object.keys(collected).length === 0) {
            setStatus("error");
            setErrorMessage("Analiz sonuçları alınamadı.");
            return;
          }

          setResults(collected);
          setStatus("success");
        } catch (err: any) {
          setStatus("error");
          setErrorMessage(err?.message || "Beklenmeyen bir hata oluştu.");
        }
      },
    );
  }, [fetchRecete, analyzeIlaclar]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Draggable title bar */}
      <div
        className="h-10 flex items-center justify-between px-4 border-b bg-muted/30"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-sm font-semibold">Kontrol Sonucu</span>
        {receteNo && (
          <span className="text-xs text-muted-foreground">{receteNo}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {status === "waiting" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Bekleniyor...</p>
          </div>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{statusText}</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-6 max-w-sm text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {status === "success" && recete && (
          <KontrolSonucPanel
            receteNo={receteNo}
            sonuclar={results}
            ilaclar={recete.ilaclar}
            onReAnalyze={handleReAnalyze}
            isReAnalyzing={isReAnalyzing}
          />
        )}
      </div>
    </div>
  );
}
