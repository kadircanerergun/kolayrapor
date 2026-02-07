import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleDot, Database, Eye, FlaskConical, Loader2, ShieldCheck, ShieldX, StopCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator as SeparatorUI } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
    bulkProgress,
  } = useAppSelector((s) => s.recete);
  const dialog = useDialogContext();
  const modal = useModal();
  const pageSize = 10;

  const [analizSheetReceteNo, setAnalizSheetReceteNo] = useState<string | null>(null);
  const bulkCancelRef = useRef(false);

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
        // Sort by analysis completeness: 0 = none, 0.x = partial, 1 = full
        const aAnalyzed = Object.keys(analizSonuclari[a.receteNo] ?? {}).length;
        const aTotal = detaylar[a.receteNo]?.ilaclar?.filter((m) => m.raporluMu).length ?? 0;
        const bAnalyzed = Object.keys(analizSonuclari[b.receteNo] ?? {}).length;
        const bTotal = detaylar[b.receteNo]?.ilaclar?.filter((m) => m.raporluMu).length ?? 0;
        aVal = aAnalyzed === 0 ? 0 : aTotal > 0 ? aAnalyzed / aTotal : 1;
        bVal = bAnalyzed === 0 ? 0 : bTotal > 0 ? bAnalyzed / bTotal : 1;
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
    setAnalizSheetReceteNo(receteNo);
  };

  // Derive sheet data from state
  const sheetSonuclar = analizSheetReceteNo ? analizSonuclari[analizSheetReceteNo] : null;
  const sheetRecete = analizSheetReceteNo ? detaylar[analizSheetReceteNo] : null;
  const sheetEntries = sheetSonuclar ? Object.entries(sheetSonuclar) : [];

  const handleBulkVerileriAl = async () => {
    bulkCancelRef.current = false;
    const selected = [...selectedRecetes];
    for (let i = 0; i < selected.length; i++) {
      if (bulkCancelRef.current) break;
      dispatch(setBulkProgress({ type: "verileriAl", current: i + 1, total: selected.length, currentReceteNo: selected[i] }));
      await dispatch(searchPrescriptionDetail({ receteNo: selected[i] }));
    }
    dispatch(setBulkProgress(null));
  };

  const handleBulkAnalizEt = async () => {
    bulkCancelRef.current = false;
    const selected = [...selectedRecetes];
    for (let i = 0; i < selected.length; i++) {
      if (bulkCancelRef.current) break;
      dispatch(setBulkProgress({ type: "analizEt", current: i + 1, total: selected.length, currentReceteNo: selected[i] }));
      await dispatch(analyzePrescription({ receteNo: selected[i] }));
    }
    dispatch(setBulkProgress(null));
  };

  const handleBulkCancel = () => {
    bulkCancelRef.current = true;
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
                    {bulkProgress.type === "verileriAl" && "Veriler alınıyor..."}
                    {bulkProgress.type === "analizEt" && "Analiz ediliyor..."}
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
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  İşleniyor: {bulkProgress.currentReceteNo}
                </p>
              </div>
            )}

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
                  const isAnalyzing = analyzingRecete === recete.receteNo;
                  const isBusy = loadingRecete !== null || analyzingRecete !== null || bulkProgress !== null;

                  // Partial analysis detection
                  const analyzedBarkods = analizSonuclari[recete.receteNo];
                  const analyzedCount = analyzedBarkods ? Object.keys(analyzedBarkods).length : 0;
                  const raporluIlaclar = detaylar[recete.receteNo]?.ilaclar?.filter((m) => m.raporluMu) ?? [];
                  const totalRaporlu = raporluIlaclar.length;
                  const hasAnalysis = analyzedCount > 0;
                  const isFullyAnalyzed = hasAnalysis && totalRaporlu > 0 && analyzedCount >= totalRaporlu;
                  const isPartiallyAnalyzed = hasAnalysis && totalRaporlu > 0 && analyzedCount < totalRaporlu;

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
                                  <Eye className="h-5 w-5 text-green-500" />
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
                                  className="mx-auto flex cursor-pointer items-center justify-center gap-1"
                                >
                                  {isPartiallyAnalyzed ? (
                                    <>
                                      <CircleDot className="h-5 w-5 text-yellow-500" />
                                      <span className="text-xs text-yellow-600 font-medium">
                                        {analyzedCount}/{totalRaporlu}
                                      </span>
                                    </>
                                  ) : (
                                    <Eye className="h-5 w-5 text-green-500" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isPartiallyAnalyzed
                                  ? `${analyzedCount}/${totalRaporlu} raporlu ilaç analiz edildi`
                                  : "Analiz sonuçlarını görüntüle"}
                              </TooltipContent>
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
                            Sorgula
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAnalizEt(recete.receteNo, hasAnalysis)}
                            disabled={isBusy}
                          >
                            <FlaskConical className="h-4 w-4" />
                            {hasAnalysis ? "Yeniden Kontrol Et" : "Kontrol Et"}
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

      <Sheet open={!!analizSheetReceteNo} onOpenChange={(open) => !open && setAnalizSheetReceteNo(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Analiz Sonuçları</SheetTitle>
            <SheetDescription>
              {analizSheetReceteNo && `Reçete: ${analizSheetReceteNo}`}
              {sheetEntries.length > 0 && ` — ${sheetEntries.length} raporlu ilaç`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {sheetEntries.map(([barkod, report]) => {
              const ilac = sheetRecete?.ilaclar?.find((m) => m.barkod === barkod);
              const scoreColor =
                report.validityScore >= 80
                  ? "border-l-green-500"
                  : report.validityScore >= 60
                    ? "border-l-yellow-500"
                    : "border-l-red-500";
              const scoreBg =
                report.validityScore >= 80
                  ? "bg-green-50 text-green-700"
                  : report.validityScore >= 60
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700";

              return (
                <div
                  key={barkod}
                  className={`rounded-lg border border-l-4 ${scoreColor} bg-card shadow-sm`}
                >
                  {/* Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">
                          {ilac?.ad || barkod}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {barkod}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-bold ${scoreBg}`}>
                        {report.isValid ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <ShieldX className="h-4 w-4" />
                        )}
                        {report.validityScore}
                      </div>
                    </div>
                  </div>

                  <SeparatorUI />

                  {/* Details grid */}
                  <div className="p-4 pt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Durum</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {report.isValid ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-700 font-medium">Geçerli</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-red-700 font-medium">Geçersiz</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">İşlem Tarihi</p>
                      <p className="mt-0.5 font-medium">{report.processedAt || "—"}</p>
                    </div>
                    {ilac?.doz && (
                      <div>
                        <p className="text-muted-foreground text-xs">Doz</p>
                        <p className="mt-0.5 font-medium">{ilac.doz}</p>
                      </div>
                    )}
                    {ilac?.adet != null && (
                      <div>
                        <p className="text-muted-foreground text-xs">Adet</p>
                        <p className="mt-0.5 font-medium">{ilac.adet}</p>
                      </div>
                    )}
                    {ilac?.periyot && (
                      <div>
                        <p className="text-muted-foreground text-xs">Periyot</p>
                        <p className="mt-0.5 font-medium">{ilac.periyot}</p>
                      </div>
                    )}
                    {ilac?.rapor?.raporNo && (
                      <div>
                        <p className="text-muted-foreground text-xs">Rapor No</p>
                        <p className="mt-0.5 font-medium">{ilac.rapor.raporNo}</p>
                      </div>
                    )}
                  </div>

                  {/* Evolution details */}
                  {report.reportEvolutionDetails && (
                    <>
                      <SeparatorUI />
                      <div className="p-4 pt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">Detaylar</p>
                        <div
                          className="text-xs leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: report.reportEvolutionDetails,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
