import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useRef, useState } from "react";
import { Recete } from "@/types/recete";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Database,
  FlaskConical,
  Loader2,
  StopCircle,
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
  analyzePrescription,
} from "@/store/slices/playwrightSlice";
import type { ReceteReportResponse } from "@/services/report-api";
import { PharmacyRequired } from "@/components/pharmacy-required";
import { ReceteTable } from "@/components/recete-table";

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
      dialog.showAlert({
        title: "Hata",
        description: `SGK portalına giderken hata: ${result.error?.message || "Bilinmeyen hata"}`,
      });
    }
  };

  const handleDetay = (receteNo: string) => {
    const cached = detaylar[receteNo];
    if (cached) openDetailModal(cached);
  };

  const handleAnalizEt = async (receteNo: string, force: boolean) => {
    const result = await dispatch(analyzePrescription({ receteNo, force }));
    if (analyzePrescription.fulfilled.match(result)) {
      const sonuclar = result.payload as Record<string, ReceteReportResponse>;
      const count = Object.keys(sonuclar).length;
      if (count === 0) {
        dialog.showAlert({
          title: "Analiz Tamamlandı",
          description: "Raporlu ilaç bulunamadı.",
        });
      }
    } else {
      dialog.showAlert({
        title: "Hata",
        description: `Analiz sırasında hata: ${result.error?.message || "Bilinmeyen hata"}`,
      });
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      dispatch(selectAllRecetes());
    } else {
      dispatch(clearReceteSelection());
    }
  };

  const handleBulkVerileriAl = async () => {
    bulkCancelRef.current = false;
    const selected = [...selectedRecetes];
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
    const selected = [...selectedRecetes];
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
      await dispatch(analyzePrescription({ receteNo: selected[i] }));
    }
    dispatch(setBulkProgress(null));
  };

  const handleBulkCancel = () => {
    bulkCancelRef.current = true;
  };

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
                        <FlaskConical className="h-4 w-4 text-purple-500" />
                        Kontrol Et
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {bulkProgress && (
                <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {bulkProgress.type === "verileriAl" &&
                        "Veriler alınıyor..."}
                      {bulkProgress.type === "analizEt" &&
                        "Analiz ediliyor..."}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-medium">
                        {bulkProgress.current}/{bulkProgress.total}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-xs"
                        onClick={handleBulkCancel}
                      >
                        <StopCircle className="h-3.5 w-3.5 mr-1" />
                        Durdur
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    İşleniyor: {bulkProgress.currentReceteNo}
                  </p>
                </div>
              )}

              <ReceteTable
                rows={receteler}
                analizSonuclari={analizSonuclari}
                detaylar={detaylar}
                loadingRecete={loadingRecete}
                analyzingRecete={analyzingRecete}
                selectable
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
