import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useCallback, useEffect, useRef, useState } from "react";
import { Recete } from "@/types/recete";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Database,
  FlaskConical,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const dialog = useDialogContext();
  const modal = useModal();
  const pageSize = 40;

  const bulkCancelRef = useRef(false);
  const sortedOrderRef = useRef<string[]>([]);
  const isBulkRef = useRef(false);

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

  const handleSorgula = async (receteNo: string, force: boolean) => {
    const result = await dispatch(
      searchPrescriptionDetail({ receteNo, force }),
    );

    if (searchPrescriptionDetail.fulfilled.match(result)) {
      openDetailModal(result.payload as Recete);
    } else {
      toast.error("Reçete sorgulanırken bir hata oluştu. Lütfen tekrar deneyin.", { duration: Infinity });
    }
  };

  const handleDetay = (receteNo: string) => {
    const cached = detaylar[receteNo];
    if (cached) openDetailModal(cached);
  };

  const handleAnalizEt = async (receteNo: string, _force: boolean) => {
    const groupId = `analyze-${receteNo}`;
    dispatch(setAnalyzingRecete(receteNo));

    dispatch(addGroup({
      id: groupId,
      title: `Reçete ${receteNo}`,
      receteNo,
      items: [{ id: "fetch", label: "Reçete verileri toplanıyor", status: "running" }],
    }));

    try {
      // 1. Fetch prescription detail
      const recete = await dispatch(searchPrescriptionDetail({ receteNo })).unwrap();
      dispatch(updateTask({ groupId, taskId: "fetch", status: "done" }));

      const raporluIlaclar = (recete?.ilaclar ?? []).filter((m: any) => m.raporluMu);
      if (raporluIlaclar.length === 0) {
        if (!isBulkRef.current) toast.info("Bu reçetede raporlu ilaç bulunamadı.");
        return;
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
            status: (idx === 0 ? "running" : "pending") as "running" | "pending",
          })),
        ],
      }));

      // 3. Analyze one by one
      for (let i = 0; i < raporluIlaclar.length; i++) {
        const ilac = raporluIlaclar[i];
        dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "running" }));
        try {
          const result = await reportApiService.generateReport(ilac.barkod, recete);
          if (result.success && result.data) {
            await cacheAnalysis(receteNo, ilac.barkod, result.data);
            dispatch(analizCompleted({ receteNo, sonuclar: { [ilac.barkod]: result.data } }));
          }
          dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "done" }));
        } catch (err: any) {
          dispatch(updateTask({ groupId, taskId: ilac.barkod, status: "error", errorMessage: "Analiz başarısız" }));
        }
      }
    } catch (err: any) {
      dispatch(updateTask({ groupId, taskId: "fetch", status: "error", errorMessage: "Reçete verileri alınamadı" }));
      if (!isBulkRef.current) toast.error("Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.");
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

  const handleBulkVerileriAl = async () => {
    bulkCancelRef.current = false;
    const selected = getSelectedInTableOrder();
    for (let i = 0; i < selected.length; i++) {
      if (bulkCancelRef.current) break;
      dispatch(
        setBulkProgress({
          type: "verileriAl",
          current: i + 1,
          total: selected.length,
          currentReceteNo: selected[i],
        }),
      );
      await dispatch(searchPrescriptionDetail({ receteNo: selected[i] }));
    }
    dispatch(setBulkProgress(null));
  };

  const handleBulkAnalizEt = async () => {
    bulkCancelRef.current = false;
    isBulkRef.current = true;
    const selected = getSelectedInTableOrder();
    for (let i = 0; i < selected.length; i++) {
      if (bulkCancelRef.current) break;
      dispatch(
        setBulkProgress({
          type: "analizEt",
          current: i + 1,
          total: selected.length,
          currentReceteNo: selected[i],
        }),
      );
      await handleAnalizEt(selected[i], true);
    }
    isBulkRef.current = false;
    dispatch(setBulkProgress(null));
  };

  const handleBulkCancel = () => {
    bulkCancelRef.current = true;
  };

  const handleAnalizEtRef = useRef(handleAnalizEt);
  handleAnalizEtRef.current = handleAnalizEt;

  useEffect(() => {
    const retryHandler = (e: Event) => {
      const { receteNo } = (e as CustomEvent).detail;
      handleAnalizEtRef.current(receteNo, true);
    };
    const cancelHandler = () => {
      bulkCancelRef.current = true;
    };
    window.addEventListener("kolayrapor:retry-analysis", retryHandler);
    window.addEventListener("kolayrapor:bulk-cancel", cancelHandler);
    return () => {
      window.removeEventListener("kolayrapor:retry-analysis", retryHandler);
      window.removeEventListener("kolayrapor:bulk-cancel", cancelHandler);
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

          {receteler.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Bulunan Reçeteler ({receteler.length})
                </h2>
                {selectedRecetes.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={!!bulkProgress}>
                        Toplu İşlem ({selectedRecetes.length})
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onClick={handleBulkVerileriAl}>
                        <Database className="h-4 w-4 text-blue-500" />
                        Sorgula
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBulkAnalizEt}>
                        <FlaskConical className="h-4 w-4 text-primary" />
                        Kontrol Et
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
