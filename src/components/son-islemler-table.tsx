import { useCallback, useEffect, useMemo, useState } from "react";
import { Recete } from "@/types/recete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Database,
  Eye,
  FlaskConical,
  Loader2,
  ShieldCheck,
  ShieldX,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator as SeparatorUI } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [analysisTimestamps, setAnalysisTimestamps] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [analizSheetReceteNo, setAnalizSheetReceteNo] = useState<
    string | null
  >(null);

  type SortKey =
    | "receteNo"
    | "receteTarihi"
    | "sonIslemTarihi"
    | "cachedAt"
    | "verilerAlindi"
    | "analizEdildi";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("sonIslemTarihi");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDir((prev) =>
        sortKey === key ? (prev === "asc" ? "desc" : "asc") : "asc",
      );
      setSortKey(key);
      setCurrentPage(1);
    },
    [sortKey],
  );

  const parseDateStr = useCallback((dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    if (dateStr.includes(".") || dateStr.includes("/")) {
      const [d, m, y] = dateStr.split(/[./]/);
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime() || 0;
    }
    return new Date(dateStr).getTime() || 0;
  }, []);

  /** Last action = max(detail cachedAt, latest analysis cachedAt) */
  const getLastActionAt = useCallback((receteNo: string, cachedAt: number): number => {
    const analysisCachedAt = analysisTimestamps[receteNo] ?? 0;
    return Math.max(cachedAt, analysisCachedAt);
  }, [analysisTimestamps]);

  const sortedReceteler = useMemo(() => {
    return [...cachedReceteler].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === "cachedAt" || sortKey === "verilerAlindi") {
        aVal = a.cachedAt;
        bVal = b.cachedAt;
      } else if (sortKey === "sonIslemTarihi") {
        aVal = getLastActionAt(a.receteNo, a.cachedAt);
        bVal = getLastActionAt(b.receteNo, b.cachedAt);
      } else if (sortKey === "receteTarihi") {
        aVal = parseDateStr(a[sortKey]);
        bVal = parseDateStr(b[sortKey]);
      } else if (sortKey === "analizEdildi") {
        const aAnalyzed = Object.keys(
          mergedAnalizSonuclari[a.receteNo] ?? {},
        ).length;
        const aTotal =
          a.ilaclar?.filter((m) => m.raporluMu).length ?? 0;
        const bAnalyzed = Object.keys(
          mergedAnalizSonuclari[b.receteNo] ?? {},
        ).length;
        const bTotal =
          b.ilaclar?.filter((m) => m.raporluMu).length ?? 0;
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
  }, [cachedReceteler, sortKey, sortDir, mergedAnalizSonuclari, parseDateStr, getLastActionAt]);

  const totalPages = sortedReceteler.length
    ? Math.ceil(sortedReceteler.length / pageSize)
    : 0;
  const paginatedReceteler = useMemo(() => {
    if (!sortedReceteler.length) return [];
    const start = (currentPage - 1) * pageSize;
    return sortedReceteler.slice(start, start + pageSize);
  }, [sortedReceteler, currentPage]);

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

  const handleDetay = (recete: CachedRecete) => {
    const { cachedAt: _, ...data } = recete;
    openDetailModal(data);
  };

  const handleYenidenVerileriAl = async (receteNo: string) => {
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

  const handleYenidenAnalizEt = async (receteNo: string) => {
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

  // Sheet data
  const sheetSonuclar = analizSheetReceteNo
    ? mergedAnalizSonuclari[analizSheetReceteNo]
    : null;
  const sheetRecete = analizSheetReceteNo
    ? cachedReceteler.find((r) => r.receteNo === analizSheetReceteNo)
    : null;
  const sheetEntries = sheetSonuclar ? Object.entries(sheetSonuclar) : [];

  const SortableHead = ({
    label,
    column,
    className,
  }: {
    label: string;
    column: SortKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => handleSort(column)}
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${sortKey === column ? "text-foreground" : "text-muted-foreground/50"}`}
        />
      </button>
    </TableHead>
  );

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
            Tarih ile Arama sayfasından reçete sorgulayarak başlayın
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {cachedReceteler.length} kayıtlı reçete
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Reçete No" column="receteNo" />
                <SortableHead
                  label="Reçete Tarihi"
                  column="receteTarihi"
                />
                <SortableHead
                  label="Son İşlem Tarihi"
                  column="sonIslemTarihi"
                />
                <TableHead>İlaç Sayısı</TableHead>
                <SortableHead
                  label="Kayıt Tarihi"
                  column="cachedAt"
                />
                <SortableHead
                  label="Analiz Edildi"
                  column="analizEdildi"
                  className="text-center"
                />
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReceteler.map((recete) => {
                const hasCachedDetail = !!detaylar[recete.receteNo];
                const isLoadingDetail = loadingRecete === recete.receteNo;
                const isAnalyzing = analyzingRecete === recete.receteNo;
                const within45 = isWithin45Days(
                  recete.sonIslemTarihi || recete.receteTarihi,
                );

                const analyzedBarkods =
                  mergedAnalizSonuclari[recete.receteNo];
                const analyzedCount = analyzedBarkods
                  ? Object.keys(analyzedBarkods).length
                  : 0;
                const raporluIlaclar =
                  recete.ilaclar?.filter((m) => m.raporluMu) ?? [];
                const totalRaporlu = raporluIlaclar.length;
                const hasAnalysis = analyzedCount > 0;
                const isPartiallyAnalyzed =
                  hasAnalysis &&
                  totalRaporlu > 0 &&
                  analyzedCount < totalRaporlu;

                const cachedDate = new Date(recete.cachedAt);

                return (
                  <TableRow key={recete.receteNo}>
                    <TableCell className="font-medium">
                      {recete.receteNo}
                    </TableCell>
                    <TableCell>{recete.receteTarihi}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(() => {
                        const ts = getLastActionAt(recete.receteNo, recete.cachedAt);
                        const d = new Date(ts);
                        return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>{recete.ilaclar?.length ?? 0}</span>
                        {totalRaporlu > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0"
                          >
                            {totalRaporlu} raporlu
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {cachedDate.toLocaleDateString("tr-TR")}{" "}
                      {cachedDate.toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                                onClick={() =>
                                  setAnalizSheetReceteNo(recete.receteNo)
                                }
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
                        {hasCachedDetail && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDetay(recete)}
                          >
                            Detay
                          </Button>
                        )}
                        {within45 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleYenidenVerileriAl(recete.receteNo)
                              }
                              disabled={isBusy}
                            >
                              {isLoadingDetail ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Database className="h-4 w-4" />
                              )}
                              {hasCachedDetail
                                ? "Yeniden Sorgula"
                                : "Sorgula"}
                            </Button>
                            <Button
                              size="sm"
                              variant={hasAnalysis ? "outline" : "default"}
                              onClick={() =>
                                handleYenidenAnalizEt(recete.receteNo)
                              }
                              disabled={isBusy}
                            >
                              {isAnalyzing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FlaskConical className="h-4 w-4" />
                              )}
                              {hasAnalysis
                                ? "Yeniden Kontrol Et"
                                : "Kontrol Et"}
                            </Button>
                          </>
                        )}
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
                {cachedReceteler.length} kayıttan{" "}
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(
                  currentPage * pageSize,
                  cachedReceteler.length,
                )}{" "}
                arası
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Önceki
                </Button>
                <span className="text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Sonraki
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ModalProvider modal={modal.modal} onClose={modal.closeModal} />

      <Sheet
        open={!!analizSheetReceteNo}
        onOpenChange={(open) => !open && setAnalizSheetReceteNo(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Analiz Sonuçları</SheetTitle>
            <SheetDescription>
              {analizSheetReceteNo && `Reçete: ${analizSheetReceteNo}`}
              {sheetEntries.length > 0 &&
                ` — ${sheetEntries.length} raporlu ilaç`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {sheetEntries.map(([barkod, report]) => {
              const ilac = sheetRecete?.ilaclar?.find(
                (m) => m.barkod === barkod,
              );
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
                      <div
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-bold ${scoreBg}`}
                      >
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

                  <div className="p-4 pt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Durum</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {report.isValid ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-700 font-medium">
                              Geçerli
                            </span>
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-red-700 font-medium">
                              Geçersiz
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        İşlem Tarihi
                      </p>
                      <p className="mt-0.5 font-medium">
                        {report.processedAt || "—"}
                      </p>
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
                        <p className="text-muted-foreground text-xs">
                          Periyot
                        </p>
                        <p className="mt-0.5 font-medium">{ilac.periyot}</p>
                      </div>
                    )}
                    {ilac?.rapor?.raporNo && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Rapor No
                        </p>
                        <p className="mt-0.5 font-medium">
                          {ilac.rapor.raporNo}
                        </p>
                      </div>
                    )}
                  </div>

                  {report.reportEvolutionDetails && (
                    <>
                      <SeparatorUI />
                      <div className="p-4 pt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">
                          Detaylar
                        </p>
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
    </>
  );
}
