import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useCallback, useEffect, useRef, useState } from "react";
import { Recete } from "@/types/recete";
import { Button } from "@/components/ui/button";
import {
  Database,
  FlaskConical,
  Loader2,
  CalendarSearch,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PrescriptionMedicinesModal } from "@/components/prescription-medicines-modal";
import { useDialogContext } from "@/contexts/dialog-context";
import { useModal } from "@/hooks/useModal";
import { ModalProvider } from "@/components/modal-provider";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  setCurrentPage,
  toggleReceteSelection,
  selectAllRecetes,
  clearReceteSelection,
  setBulkProgress,
} from "@/store/slices/receteSlice";
import {
  searchPrescriptionDetail,
} from "@/store/slices/playwrightSlice";
import { reportApiService, type ReceteReportResponse } from "@/services/report-api";
import { cacheAnalysis } from "@/lib/db";
import { bulkCancel } from "@/lib/bulk-cancel";
import { toUserFriendlyError } from "@/utils/error-messages";
import { analizCompleted, setAnalyzingRecete } from "@/store/slices/receteSlice";
import { addGroup, updateTask } from "@/store/slices/taskQueueSlice";
import { PharmacyRequired } from "@/components/pharmacy-required";
import { ReceteTable } from "@/components/recete-table";
import { toast } from "sonner";

function SearchReport() {
  const dispatch = useAppDispatch();
  const {
    receteler,
    currentPage,
    selectedRecetes,
    loadingRecete,
    detaylar,
    analizSonuclari,
    analyzingRecete,
    bulkProgress,
  } = useAppSelector((s) => s.recete);
  const playwrightLoading = useAppSelector((s) => s.playwright.isLoading);
  const dialog = useDialogContext();
  const modal = useModal();
  const pageSize = 40;

  const sortedOrderRef = useRef<string[]>([]);
  const isBulkRef = useRef(false);

  const openDetailModal = (prescriptionData: Recete, receteNo?: string) => {
    const ozet = receteler.find((r) => r.receteNo === (receteNo || prescriptionData.receteNo));
    modal.openModal(
      <PrescriptionMedicinesModal
        prescriptionData={prescriptionData}
        hastaAd={ozet?.ad}
        hastaSoyad={ozet?.soyad}
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

  const handleSorgula = async (receteNo: string, force: boolean) => {
    const result = await dispatch(
      searchPrescriptionDetail({ receteNo, force }),
    );

    if (searchPrescriptionDetail.fulfilled.match(result)) {
      openDetailModal(result.payload as Recete, receteNo);
    } else {
      // Eksik veri hatası hangi alanların okunamadığını söylüyor; genel mesaj
      // yerine onu göster.
      toast.error(
        toUserFriendlyError(
          result.error?.message,
          "Reçete sorgulanırken bir hata oluştu. Lütfen tekrar deneyin.",
        ),
        { duration: Infinity },
      );
    }
  };

  const handleDetay = (receteNo: string) => {
    const cached = detaylar[receteNo];
    if (cached) openDetailModal(cached, receteNo);
  };

  /**
   * Tek reçeteyi kontrol eder. Dönen değer reçete verilerinin toplanıp
   * toplanamadığını söyler: `false` ise reçete eksik veri yüzünden kontrol
   * edilemedi ve toplu akışta tekrar denenecek.
   */
  const handleAnalizEt = async (
    receteNo: string,
    force: boolean,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    const groupId = `analyze-${receteNo}`;
    dispatch(setAnalyzingRecete(receteNo));

    dispatch(addGroup({
      id: groupId,
      title: `Reçete ${receteNo}`,
      receteNo,
      items: [{ id: "fetch", label: "Reçete verileri toplanıyor", status: "running" }],
    }));

    try {
      // 1. Fetch prescription detail — "Tekrar Kontrol" (force) always re-reads
      // the prescription from Medula instead of using the cached detail.
      const recete = await dispatch(
        searchPrescriptionDetail({ receteNo, force }),
      ).unwrap();
      dispatch(updateTask({ groupId, taskId: "fetch", status: "done" }));

      if (signal?.aborted || bulkCancel.isCancelled()) return true;

      const raporluIlaclar = (recete?.ilaclar ?? []).filter((m: any) => m.raporluMu);
      if (raporluIlaclar.length === 0) {
        if (!isBulkRef.current) toast.info("Bu reçetede raporlu ilaç bulunamadı.");
        return true;
      }

      // 2. Add per-medicine tasks
      dispatch(addGroup({
        id: groupId,
        title: `Reçete ${receteNo}`,
      receteNo,
        items: [
          { id: "fetch", label: "Reçete verileri toplanıyor", status: "done" },
          ...raporluIlaclar.map((m: any, idx: number) => ({
            id: m.barkod,
            label: m.ad || m.barkod,
            kind: "medicine" as const,
            status: (idx === 0 ? "running" : "pending") as "running" | "pending",
          })),
        ],
      }));

      // 3. Analyze one by one
      for (let i = 0; i < raporluIlaclar.length; i++) {
        if (signal?.aborted || bulkCancel.isCancelled()) break;
        const ilac = raporluIlaclar[i];
        dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "running" }));
        try {
          const result = await reportApiService.generateReport(ilac.barkod, recete, signal);
          if (result.success && result.data) {
            await cacheAnalysis(receteNo, ilac.barkod, result.data);
            dispatch(analizCompleted({ receteNo, sonuclar: { [ilac.barkod]: result.data } }));
          }
          dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "done" }));
        } catch (err: any) {
          if (signal?.aborted || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
            dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "pending" }));
            break;
          }
          dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "error", errorMessage: "Analiz başarısız" }));
        }
      }
      return true;
    } catch (err: any) {
      dispatch(updateTask({ groupId, taskId: "fetch", status: "error", errorMessage: "Reçete verileri alınamadı" }));
      if (!isBulkRef.current) toast.error("Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      return false;
    } finally {
      dispatch(setAnalyzingRecete(null));
    }
  };

  const handleSelectRecete = (receteNo: string, checked: boolean) => {
    if (checked) {
      if (!selectedRecetes.includes(receteNo)) {
        dispatch(toggleReceteSelection(receteNo));
      }
    } else {
      if (selectedRecetes.includes(receteNo)) {
        dispatch(toggleReceteSelection(receteNo));
      }
    }
  };

  const handleSelectAll = (checked: boolean, filteredReceteNos?: string[]) => {
    if (checked && filteredReceteNos) {
      // Select only filtered rows
      dispatch(clearReceteSelection());
      for (const receteNo of filteredReceteNos) {
        if (!selectedRecetes.includes(receteNo)) {
          dispatch(toggleReceteSelection(receteNo));
        }
      }
    } else if (checked) {
      dispatch(selectAllRecetes());
    } else {
      dispatch(clearReceteSelection());
    }
  };

  const getSelectedInTableOrder = () => {
    const order = sortedOrderRef.current;
    return [...selectedRecetes].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
  };

  /**
   * Verilen reçetelerin verilerini sırayla alır ve ALINAMAYANLARI döner.
   * İkinci turda `force` ile çağrılır: önbelleği atlayıp Medula'dan yeniden
   * okur, çünkü ilk turdaki başarısızlık genelde geçici bir okuma hatasıdır.
   */
  const bulkVerileriAlPass = async (
    receteNos: string[],
    force = false,
  ): Promise<string[]> => {
    const basarisiz: string[] = [];
    for (let i = 0; i < receteNos.length; i++) {
      if (bulkCancel.isCancelled()) break;
      dispatch(
        setBulkProgress({
          type: "verileriAl",
          current: i + 1,
          total: receteNos.length,
          currentReceteNo: receteNos[i],
        }),
      );
      const result = await dispatch(
        searchPrescriptionDetail({ receteNo: receteNos[i], force }),
      );
      if (!searchPrescriptionDetail.fulfilled.match(result)) {
        basarisiz.push(receteNos[i]);
      }
      if (bulkCancel.isCancelled()) break;
    }
    return basarisiz;
  };

  const handleBulkVerileriAl = async () => {
    bulkCancel.start();
    const selected = getSelectedInTableOrder();
    try {
      // Eksik veri yüzünden alınamayanlar toplanıp turun sonunda bir kez daha
      // denenir; hâlâ alınamayanlar kullanıcıya liste hâlinde bildirilir —
      // sessizce eksik kalmasınlar.
      const basarisiz = await bulkVerileriAlPass(selected);
      const kalan = bulkCancel.isCancelled()
        ? basarisiz
        : await bulkVerileriAlPass(basarisiz, true);
      if (kalan.length > 0 && !bulkCancel.isCancelled()) {
        toast.error(
          `${kalan.length} reçetenin verileri eksiksiz alınamadı: ${kalan.join(", ")}. Lütfen bu reçeteleri tekrar sorgulayın.`,
          { duration: Infinity },
        );
      }
    } finally {
      bulkCancel.reset();
      dispatch(setBulkProgress(null));
    }
  };

  /** Verilen reçeteleri sırayla kontrol eder ve verisi alınamayanları döner. */
  const bulkAnalizPass = async (
    receteNos: string[],
    signal: AbortSignal,
    force: boolean,
  ): Promise<string[]> => {
    const basarisiz: string[] = [];
    for (let i = 0; i < receteNos.length; i++) {
      if (bulkCancel.isCancelled()) break;
      dispatch(
        setBulkProgress({
          type: "analizEt",
          current: i + 1,
          total: receteNos.length,
          currentReceteNo: receteNos[i],
        }),
      );
      const tamam = await handleAnalizEt(receteNos[i], force, signal);
      if (!tamam) basarisiz.push(receteNos[i]);
      if (bulkCancel.isCancelled()) break;
    }
    return basarisiz;
  };

  const handleBulkAnalizEt = async () => {
    isBulkRef.current = true;
    const signal = bulkCancel.start();
    const selected = getSelectedInTableOrder();
    try {
      // İlk tur önbellekteki detayları kullanır (force = false) ki büyük bir
      // seçim her reçeteyi yeniden kazımasın. Verisi alınamayanlar turun
      // sonunda force ile bir kez daha denenir, kalanlar listelenir.
      const basarisiz = await bulkAnalizPass(selected, signal, false);
      const kalan = bulkCancel.isCancelled()
        ? basarisiz
        : await bulkAnalizPass(basarisiz, signal, true);
      if (kalan.length > 0 && !bulkCancel.isCancelled()) {
        toast.error(
          `${kalan.length} reçete eksik veri yüzünden kontrol edilemedi: ${kalan.join(", ")}. Lütfen bu reçeteleri tekrar deneyin.`,
          { duration: Infinity },
        );
      }
    } finally {
      bulkCancel.reset();
      isBulkRef.current = false;
      dispatch(setBulkProgress(null));
    }
  };

  const handleAnalizEtRef = useRef(handleAnalizEt);
  handleAnalizEtRef.current = handleAnalizEt;

  useEffect(() => {
    const retryHandler = (e: Event) => {
      const { receteNo } = (e as CustomEvent).detail;
      handleAnalizEtRef.current(receteNo, true);
    };
    window.addEventListener("kolayrapor:retry-analysis", retryHandler);
    return () => {
      window.removeEventListener("kolayrapor:retry-analysis", retryHandler);
    };
  }, []);

  const isBusy =
    loadingRecete !== null || analyzingRecete !== null || bulkProgress !== null;

  return (
    <PharmacyRequired>
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Toplu Kontrol</h1>
            <p className="text-muted-foreground">
              SGK sisteminde reçete bilgilerini sorgulayın
            </p>
          </div>
          <div className={"flex flex-row gap-3 overflow-y-hidden"}>
            <SearchByDateRange />
          </div>

          {receteler.length === 0 && !playwrightLoading && (
            <div className="mt-10 flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed bg-muted/30">
              <div className="rounded-full bg-background p-3 mb-3 border">
                <CalendarSearch className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">Henüz sonuç yok</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Yukarıdan tarih aralığı ve fatura türü seçip{" "}
                <span className="font-medium">Ara</span>'ya basın. Bulunan
                reçeteler burada listelenir.
              </p>
            </div>
          )}

          {receteler.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Bulunan Reçeteler ({receteler.length})
                </h2>
                {selectedRecetes.length > 0 && (
                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!!bulkProgress}
                            onClick={handleBulkVerileriAl}
                          >
                            <Database className="h-4 w-4 shrink-0 text-blue-500" />
                            Sorgula ({selectedRecetes.length})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="max-w-[220px] text-xs">
                            Reçeteleri ve İlaç Raporlarını okur, kredi harcamaz
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="bg-brand text-brand-foreground hover:bg-brand/90"
                            disabled={!!bulkProgress}
                            onClick={handleBulkAnalizEt}
                          >
                            <FlaskConical className="h-4 w-4 shrink-0" />
                            Kontrol Et ({selectedRecetes.length})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="max-w-[220px] text-xs">
                            Yapay Zeka ile SUT uygunluğunu kontrol eder
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                )}
              </div>

              {/* Bulk progress is shown in the GlobalTaskPanel (bottom-right) */}

              <ReceteTable
                rows={receteler}
                analizSonuclari={analizSonuclari}
                detaylar={detaylar}
                loadingRecete={loadingRecete}
                analyzingRecete={analyzingRecete}
                selectable
                showSonIslemTarihi={false}
                selectedRecetes={selectedRecetes}
                onSelectRecete={handleSelectRecete}
                onSelectAll={handleSelectAll}
                showHasta
                showFilters
                showQuickSearch
                compact
                onSorgula={handleSorgula}
                onAnalizEt={handleAnalizEt}
                onDetay={handleDetay}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={(page) => dispatch(setCurrentPage(page))}
                isBusy={isBusy}
                onSortedOrderChange={(order) => {
                  sortedOrderRef.current = order;
                }}
              />
            </div>
          )}
        </div>
        <ModalProvider modal={modal.modal} onClose={modal.closeModal} />
      </div>
    </PharmacyRequired>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
