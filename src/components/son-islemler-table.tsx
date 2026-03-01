import { useCallback, useEffect, useMemo, useState } from "react";
import { Recete } from "@/types/recete";
import { Button } from "@/components/ui/button";
import { Database, Loader2, Trash2 } from "lucide-react";
import { PrescriptionMedicinesModal } from "@/components/prescription-medicines-modal";
import { useDialogContext } from "@/contexts/dialog-context";
import { useModal } from "@/hooks/useModal";
import { ModalProvider } from "@/components/modal-provider";
import { useAppDispatch, useAppSelector } from "@/store";
import { detayFetched, analizCompleted } from "@/store/slices/receteSlice";
import {
  searchPrescriptionDetail,
  analyzePrescription,
} from "@/store/slices/playwrightSlice";
import type { ReceteReportResponse } from "@/services/report-api";
import {
  type CachedRecete,
  getAllCachedReceteler,
  getAllCachedAnalysis,
  getLatestAnalysisTimestamps,
  clearCache,
} from "@/lib/db";
import { ReceteTable } from "@/components/recete-table";

interface SonIslemlerTableProps {
  showHeader?: boolean;
  onDataLoaded?: (data: {
    cachedReceteler: CachedRecete[];
    analizSonuclari: Record<string, Record<string, ReceteReportResponse>>;
  }) => void;
}

export function SonIslemlerTable({
  showHeader = true,
  onDataLoaded,
}: SonIslemlerTableProps) {
  const dispatch = useAppDispatch();
  const { loadingRecete, analyzingRecete, detaylar, analizSonuclari } =
    useAppSelector((s) => s.recete);
  const dialog = useDialogContext();
  const modal = useModal();

  const [cachedReceteler, setCachedReceteler] = useState<CachedRecete[]>([]);
  const [localAnalizSonuclari, setLocalAnalizSonuclari] = useState<
    Record<string, Record<string, ReceteReportResponse>>
  >({});
  const [analysisTimestamps, setAnalysisTimestamps] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Load data from Dexie on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [receteler, analiz, timestamps] = await Promise.all([
        getAllCachedReceteler(),
        getAllCachedAnalysis(),
        getLatestAnalysisTimestamps(),
      ]);
      setCachedReceteler(receteler);
      setLocalAnalizSonuclari(analiz);
      setAnalysisTimestamps(timestamps);

      // Also hydrate Redux state so re-analyze/re-fetch work properly
      for (const r of receteler) {
        if (!detaylar[r.receteNo]) {
          const { cachedAt: _, ...recete } = r;
          dispatch(detayFetched(recete));
        }
      }
      for (const [receteNo, sonuclar] of Object.entries(analiz)) {
        if (!analizSonuclari[receteNo]) {
          dispatch(analizCompleted({ receteNo, sonuclar }));
        }
      }

      onDataLoaded?.({ cachedReceteler: receteler, analizSonuclari: analiz });
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Merge Redux updates back into local state for live feedback
  const mergedAnalizSonuclari = useMemo(() => {
    return { ...localAnalizSonuclari, ...analizSonuclari };
  }, [localAnalizSonuclari, analizSonuclari]);

  const isWithin45Days = useCallback((dateStr: string) => {
    if (!dateStr) return false;
    let date: Date;
    if (dateStr.includes(".") || dateStr.includes("/")) {
      const [d, m, y] = dateStr.split(/[./]/);
      date = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return false;
    const diffMs = Date.now() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 45;
  }, []);

  /** Last action = max(detail cachedAt, latest analysis cachedAt) */
  const getLastActionAt = useCallback(
    (receteNo: string, cachedAt: number): number => {
      const analysisCachedAt = analysisTimestamps[receteNo] ?? 0;
      return Math.max(cachedAt, analysisCachedAt);
    },
    [analysisTimestamps],
  );

  const openDetailModal = (prescriptionData: Recete) => {
    modal.openModal(
      <PrescriptionMedicinesModal
        prescriptionData={prescriptionData}
        onQueryMedicine={(medicine) => {
          console.log("Querying medicine:", medicine);
        }}
      />,
      {
        title: "Reçete Detayları",
        size: "6xl",
      },
    );
  };

  const handleDetay = (receteNo: string) => {
    const recete = cachedReceteler.find((r) => r.receteNo === receteNo);
    if (recete) {
      const { cachedAt: _, ...data } = recete;
      openDetailModal(data);
    }
  };

  const handleSorgula = async (receteNo: string, _force: boolean) => {
    const result = await dispatch(
      searchPrescriptionDetail({ receteNo, force: true }),
    );
    if (searchPrescriptionDetail.fulfilled.match(result)) {
      const updated = await getAllCachedReceteler();
      setCachedReceteler(updated);
    } else {
      dialog.showAlert({
        title: "Hata",
        description: `Veri alınırken hata: ${result.error?.message || "Bilinmeyen hata"}`,
      });
    }
  };

  const handleAnalizEt = async (receteNo: string, _force: boolean) => {
    const result = await dispatch(
      analyzePrescription({ receteNo, force: true }),
    );
    if (analyzePrescription.fulfilled.match(result)) {
      const [updatedAnaliz, updatedTimestamps] = await Promise.all([
        getAllCachedAnalysis(),
        getLatestAnalysisTimestamps(),
      ]);
      setLocalAnalizSonuclari(updatedAnaliz);
      setAnalysisTimestamps(updatedTimestamps);
    } else {
      dialog.showAlert({
        title: "Hata",
        description: `Analiz sırasında hata: ${result.error?.message || "Bilinmeyen hata"}`,
      });
    }
  };

  const handleClearCache = async () => {
    dialog.showAlert({
      title: "Önbelleği Temizle",
      description:
        "Tüm kaydedilmiş reçete verileri ve analiz sonuçları silinecek. Devam etmek istiyor musunuz?",
      confirmText: "Temizle",
      onConfirm: async () => {
        await clearCache();
        setCachedReceteler([]);
        setLocalAnalizSonuclari({});
      },
    });
  };

  const isBusy = loadingRecete !== null || analyzingRecete !== null;

  return (
    <>
      {showHeader && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Son İşlemler</h2>
            <p className="text-muted-foreground text-sm">
              Daha önce sorgulanan ve analiz edilen reçeteler
            </p>
          </div>
          {cachedReceteler.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Önbelleği Temizle
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Yükleniyor...</span>
        </div>
      ) : cachedReceteler.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Henüz veri yok</p>
          <p className="text-sm mt-1">
            Toplu Kontrol sayfasından reçete sorgulayarak başlayın
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {cachedReceteler.length} kayıtlı reçete
            </p>
          </div>

          <ReceteTable
            rows={cachedReceteler}
            analizSonuclari={mergedAnalizSonuclari}
            detaylar={detaylar}
            loadingRecete={loadingRecete}
            analyzingRecete={analyzingRecete}
            showSonIslemTarihi
            showKayitTarihi
            showFilters
            onSorgula={handleSorgula}
            onAnalizEt={handleAnalizEt}
            onDetay={handleDetay}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isBusy={isBusy}
            isWithin45Days={isWithin45Days}
            getLastActionAt={getLastActionAt}
            onReAnalyze={(receteNo) => handleAnalizEt(receteNo, true)}
            isReAnalyzing={(receteNo) => analyzingRecete === receteNo}
          />
        </div>
      )}

      <ModalProvider modal={modal.modal} onClose={modal.closeModal} />
    </>
  );
}
