import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useCallback, useMemo, useState } from "react";
import { Recete, ReceteOzet } from "@/types/recete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, ChevronLeft, ChevronRight, CircleCheck, Circle, FlaskConical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
} from "@/store/slices/receteSlice";
import { searchPrescriptionDetail, analyzePrescription } from "@/store/slices/playwrightSlice";
import type { ReceteReportResponse } from "@/services/report-api";

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
  } = useAppSelector((s) => s.recete);
  const dialog = useDialogContext();
  const modal = useModal();
  const pageSize = 10;

  type SortKey = keyof ReceteOzet | "verilerAlindi" | "analizEdildi";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((key: SortKey) => {
    setSortDir((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(key);
    dispatch(setCurrentPage(1));
  }, [sortKey, dispatch]);

  const sortedReceteler = useMemo(() => {
    if (!sortKey) return receteler;
    return [...receteler].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === "verilerAlindi") {
        aVal = detaylar[a.receteNo] ? 1 : 0;
        bVal = detaylar[b.receteNo] ? 1 : 0;
      } else if (sortKey === "analizEdildi") {
        aVal = analizSonuclari[a.receteNo] ? 1 : 0;
        bVal = analizSonuclari[b.receteNo] ? 1 : 0;
      } else {
        aVal = a[sortKey] ?? "";
        bVal = b[sortKey] ?? "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [receteler, sortKey, sortDir, detaylar, analizSonuclari]);

  const totalPages = sortedReceteler.length ? Math.ceil(sortedReceteler.length / pageSize) : 0;
  const paginatedReceteler = useMemo(() => {
    if (!sortedReceteler.length) return [];
    const start = (currentPage - 1) * pageSize;
    return sortedReceteler.slice(start, start + pageSize);
  }, [sortedReceteler, currentPage]);

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

  const handleSorgula = async (receteNo: string, force = false) => {
    const result = await dispatch(searchPrescriptionDetail({ receteNo, force }));

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

  const handleAnalizEt = async (receteNo: string, force = false) => {
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

  const handleAnalizSonuclariGoster = (receteNo: string) => {
    const sonuclar = analizSonuclari[receteNo];
    const recete = detaylar[receteNo];
    if (!sonuclar) return;

    const entries = Object.entries(sonuclar);
    modal.openModal(
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-muted-foreground">
          {entries.length} raporlu ilaç analiz edildi
        </p>
        {entries.map(([barkod, report]) => {
          const ilac = recete?.ilaclar?.find((m) => m.barkod === barkod);
          const color =
            report.isValid && report.validityScore >= 80
              ? "bg-green-100 text-green-800 border-green-200"
              : report.isValid && report.validityScore >= 60
                ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                : "bg-red-100 text-red-800 border-red-200";
          return (
            <div key={barkod} className={`rounded-lg border p-3 ${color}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {ilac?.ad || barkod}
                  </p>
                  <p className="text-xs">Barkod: {barkod}</p>
                </div>
                <Badge variant="outline" className={color}>
                  {report.validityScore}%
                </Badge>
              </div>
              {report.reportEvolutionDetails && (
                <div
                  className="mt-2 text-xs prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: report.reportEvolutionDetails,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>,
      {
        title: "Analiz Sonuçları",
        size: "4xl",
      },
    );
  };

  const handleBulkProcess = () => {
    console.log("Toplu işlem:", selectedRecetes);
    // TODO: Implement bulk processing logic
  };

  const SortableHead = ({ label, column, className }: { label: string; column: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => handleSort(column)}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === column ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );

  const isAllSelected = receteler.length > 0 && selectedRecetes.length === receteler.length;
  const isSomeSelected = selectedRecetes.length > 0 && selectedRecetes.length < receteler.length;

  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reçete Arama</h1>
          <p className="text-muted-foreground">
            SGK sisteminde reçete bilgilerini sorgulayın
          </p>
        </div>
        <div className={"flex flex-row gap-3 overflow-y-hidden"}>
          <SearchByDateRange />
        </div>
        {totalPages > 1 && (
          <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm">
              {receteler.length} sonuctan {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, receteler.length)} arasi
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => dispatch(setCurrentPage(currentPage - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Onceki
              </Button>
              <span className="text-sm font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => dispatch(setCurrentPage(currentPage + 1))}
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {receteler.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Bulunan Reçeteler ({receteler.length})
              </h2>
              {selectedRecetes.length > 0 && (
                <Button onClick={handleBulkProcess} variant="outline">
                  Toplu İşlem ({selectedRecetes.length})
                </Button>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      ref={(checkbox) => {
                        if (checkbox) {
                          checkbox.indeterminate = isSomeSelected;
                        }
                      }}
                    />
                  </TableHead>
                  <SortableHead label="Reçete No" column="receteNo" />
                  <SortableHead label="Hasta" column="ad" />
                  <SortableHead label="Kapsam" column="kapsam" />
                  <SortableHead label="Reçete Tarihi" column="receteTarihi" />
                  <SortableHead label="Son İşlem Tarihi" column="sonIslemTarihi" />
                  <SortableHead label="Veriler Alındı" column="verilerAlindi" className="text-center" />
                  <SortableHead label="Analiz Edildi" column="analizEdildi" className="text-center" />
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReceteler.map((recete) => {
                  const hasCachedDetail = !!detaylar[recete.receteNo];
                  const isLoadingDetail = loadingRecete === recete.receteNo;
                  const hasAnalysis = !!analizSonuclari[recete.receteNo];
                  const isAnalyzing = analyzingRecete === recete.receteNo;
                  const isBusy = loadingRecete !== null || analyzingRecete !== null;

                  return (
                    <TableRow key={recete.receteNo}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecetes.includes(recete.receteNo)}
                          onCheckedChange={(checked) =>
                            handleSelectRecete(recete.receteNo, !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {recete.receteNo}
                      </TableCell>
                      <TableCell>
                        {recete.ad} {recete.soyad}
                      </TableCell>
                      <TableCell>{recete.kapsam}</TableCell>
                      <TableCell>{recete.receteTarihi}</TableCell>
                      <TableCell>{recete.sonIslemTarihi}</TableCell>

                      {/* Veriler Alındı column */}
                      <TableCell className="text-center">
                        {isLoadingDetail ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                        ) : hasCachedDetail ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDetay(recete.receteNo)}
                                  className="mx-auto flex cursor-pointer items-center justify-center"
                                >
                                  <CircleCheck className="h-5 w-5 text-green-500" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Detayları görüntüle</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Circle className="mx-auto h-5 w-5 text-muted-foreground/30" />
                        )}
                      </TableCell>

                      {/* Analiz Edildi column */}
                      <TableCell className="text-center">
                        {isAnalyzing ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                        ) : hasAnalysis ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleAnalizSonuclariGoster(recete.receteNo)}
                                  className="mx-auto flex cursor-pointer items-center justify-center"
                                >
                                  <CircleCheck className="h-5 w-5 text-green-500" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Analiz sonuçlarını görüntüle</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Circle className="mx-auto h-5 w-5 text-muted-foreground/30" />
                        )}
                      </TableCell>

                      {/* İşlemler column */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant={hasCachedDetail ? "ghost" : "default"}
                            onClick={() => handleSorgula(recete.receteNo, hasCachedDetail)}
                            disabled={isBusy}
                          >
                            Verileri Al
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAnalizEt(recete.receteNo, hasAnalysis)}
                            disabled={isBusy}
                          >
                            <FlaskConical className="h-4 w-4" />
                            {hasAnalysis ? "Yeniden Analiz Et" : "Analiz Et"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-sm">
                  {receteler.length} sonuctan {(currentPage - 1) * pageSize + 1}
                  -{Math.min(currentPage * pageSize, receteler.length)} arasi
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => dispatch(setCurrentPage(currentPage - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Onceki
                  </Button>
                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => dispatch(setCurrentPage(currentPage + 1))}
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ModalProvider modal={modal.modal} onClose={modal.closeModal} />
    </div>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
