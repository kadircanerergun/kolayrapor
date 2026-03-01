import { useCallback, useMemo, useState } from "react";
import type { ReceteIlac, Recete } from "@/types/recete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Database,
  Eye,
  FlaskConical,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { ReceteReportResponse } from "@/services/report-api";
import { KontrolSonucPanel } from "@/components/kontrol-sonuc-panel";

export interface ReceteTableRow {
  receteNo: string;
  receteTarihi: string;
  sonIslemTarihi?: string;
  ad?: string;
  soyad?: string;
  ilaclar?: ReceteIlac[];
  cachedAt?: number;
}

export interface ReceteTableProps {
  rows: ReceteTableRow[];
  analizSonuclari: Record<string, Record<string, ReceteReportResponse>>;
  detaylar: Record<string, Recete>;
  loadingRecete: string | null;
  analyzingRecete: string | null;

  // Optional features
  selectable?: boolean;
  selectedRecetes?: string[];
  onSelectRecete?: (receteNo: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;

  showHasta?: boolean;
  showSonIslemTarihi?: boolean;
  showKayitTarihi?: boolean;

  // Callbacks
  onSorgula: (receteNo: string, force: boolean) => void;
  onAnalizEt: (receteNo: string, force: boolean) => void;
  onDetay: (receteNo: string) => void;

  // Pagination
  pageSize?: number;
  currentPage: number;
  onPageChange: (page: number) => void;

  isBusy?: boolean;
  isWithin45Days?: (dateStr: string) => boolean;
  getLastActionAt?: (receteNo: string, cachedAt: number) => number;
  compact?: boolean;
  showFilters?: boolean;
  onReAnalyze?: (receteNo: string) => void;
  isReAnalyzing?: (receteNo: string) => boolean;
}

type SortKey =
  | "receteNo"
  | "ad"
  | "receteTarihi"
  | "sonIslemTarihi"
  | "cachedAt"
  | "analizEdildi";
type SortDir = "asc" | "desc";

type FilterStatus =
  | "all"
  | "unchecked"
  | "checked"
  | "valid"
  | "invalid"
  | "suspicious";

function getFilterLabel(filter: FilterStatus): string {
  switch (filter) {
    case "all":
      return "Tümü";
    case "unchecked":
      return "Kontrol Edilmedi";
    case "checked":
      return "Kontrol Edildi";
    case "valid":
      return "Uygun";
    case "invalid":
      return "Uygun Değil";
    case "suspicious":
      return "Şüpheli";
  }
}

type AnalysisStatus = "green" | "orange" | "red";

function getAnalysisStatus(
  sonuclar: Record<string, ReceteReportResponse> | undefined,
): AnalysisStatus {
  if (!sonuclar) return "green";
  const scores = Object.values(sonuclar).map((r) => r.validityScore ?? 0);
  if (scores.some((s) => s < 60)) return "red";
  if (scores.some((s) => s < 80)) return "orange";
  return "green";
}

const statusIconColor: Record<AnalysisStatus, string> = {
  green: "text-green-500",
  orange: "text-orange-500",
  red: "text-red-500",
};

const statusTooltip: Record<AnalysisStatus, string> = {
  green: "Uygun — Analiz sonuçlarını görüntüle",
  orange: "Şüpheli — Analiz sonuçlarını görüntüle",
  red: "Uygun Değil — Analiz sonuçlarını görüntüle",
};

const FILTER_OPTIONS: FilterStatus[] = [
  "all",
  "unchecked",
  "checked",
  "valid",
  "invalid",
  "suspicious",
];

export function ReceteTable({
  rows,
  analizSonuclari,
  detaylar,
  loadingRecete,
  analyzingRecete,
  selectable = false,
  selectedRecetes = [],
  onSelectRecete,
  onSelectAll,
  showHasta = false,
  showSonIslemTarihi = false,
  showKayitTarihi = false,
  onSorgula,
  onAnalizEt,
  onDetay,
  pageSize = 10,
  currentPage,
  onPageChange,
  isBusy = false,
  isWithin45Days,
  getLastActionAt,
  compact = false,
  showFilters = false,
  onReAnalyze,
  isReAnalyzing,
}: ReceteTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(
    showSonIslemTarihi ? "sonIslemTarihi" : null,
  );
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [analizSheetReceteNo, setAnalizSheetReceteNo] = useState<
    string | null
  >(null);

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDir((prev) =>
        sortKey === key ? (prev === "asc" ? "desc" : "asc") : "asc",
      );
      setSortKey(key);
      onPageChange(1);
    },
    [sortKey, onPageChange],
  );

  const parseDateStr = useCallback((dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    if (dateStr.includes(".") || dateStr.includes("/")) {
      const [d, m, y] = dateStr.split(/[./]/);
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime() || 0;
    }
    return new Date(dateStr).getTime() || 0;
  }, []);

  /** Get ilaclar from row or detaylar fallback */
  const getIlaclar = useCallback(
    (row: ReceteTableRow): ReceteIlac[] | undefined => {
      return row.ilaclar ?? detaylar[row.receteNo]?.ilaclar;
    },
    [detaylar],
  );

  const getAnalysisInfo = useCallback(
    (receteNo: string, ilaclar?: ReceteIlac[]) => {
      const analyzedBarkods = analizSonuclari[receteNo];
      const analyzedCount = analyzedBarkods
        ? Object.keys(analyzedBarkods).length
        : 0;
      const raporluIlaclar = ilaclar?.filter((m) => m.raporluMu) ?? [];
      const totalRaporlu = raporluIlaclar.length;
      const hasAnalysis = analyzedCount > 0;
      const isPartiallyAnalyzed =
        hasAnalysis && totalRaporlu > 0 && analyzedCount < totalRaporlu;
      return {
        analyzedCount,
        totalRaporlu,
        hasAnalysis,
        isPartiallyAnalyzed,
        analyzedBarkods,
      };
    },
    [analizSonuclari],
  );

  // Filter rows
  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    return rows.filter((row) => {
      const ilaclar = getIlaclar(row);
      const { hasAnalysis, analyzedBarkods } = getAnalysisInfo(
        row.receteNo,
        ilaclar,
      );

      switch (activeFilter) {
        case "unchecked":
          return !hasAnalysis;
        case "checked":
          return hasAnalysis;
        case "valid":
          if (!analyzedBarkods) return false;
          return Object.values(analyzedBarkods).every(
            (r) => (r.validityScore ?? 0) >= 80,
          );
        case "invalid":
          if (!analyzedBarkods) return false;
          return Object.values(analyzedBarkods).some(
            (r) => (r.validityScore ?? 0) < 60,
          );
        case "suspicious":
          if (!analyzedBarkods) return false;
          return Object.values(analyzedBarkods).some((r) => {
            const score = r.validityScore ?? 0;
            return score >= 60 && score < 80;
          });
        default:
          return true;
      }
    });
  }, [rows, activeFilter, getIlaclar, getAnalysisInfo]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === "cachedAt") {
        aVal = a.cachedAt ?? 0;
        bVal = b.cachedAt ?? 0;
      } else if (sortKey === "sonIslemTarihi") {
        if (getLastActionAt && a.cachedAt != null && b.cachedAt != null) {
          aVal = getLastActionAt(a.receteNo, a.cachedAt);
          bVal = getLastActionAt(b.receteNo, b.cachedAt);
        } else {
          aVal = parseDateStr(a.sonIslemTarihi);
          bVal = parseDateStr(b.sonIslemTarihi);
        }
      } else if (sortKey === "receteTarihi") {
        aVal = parseDateStr(a.receteTarihi);
        bVal = parseDateStr(b.receteTarihi);
      } else if (sortKey === "analizEdildi") {
        const aIlaclar = getIlaclar(a);
        const bIlaclar = getIlaclar(b);
        const aInfo = getAnalysisInfo(a.receteNo, aIlaclar);
        const bInfo = getAnalysisInfo(b.receteNo, bIlaclar);
        aVal =
          aInfo.analyzedCount === 0
            ? 0
            : aInfo.totalRaporlu > 0
              ? aInfo.analyzedCount / aInfo.totalRaporlu
              : 1;
        bVal =
          bInfo.analyzedCount === 0
            ? 0
            : bInfo.totalRaporlu > 0
              ? bInfo.analyzedCount / bInfo.totalRaporlu
              : 1;
      } else if (sortKey === "ad") {
        aVal = `${a.ad ?? ""} ${a.soyad ?? ""}`.trim();
        bVal = `${b.ad ?? ""} ${b.soyad ?? ""}`.trim();
      } else {
        aVal = a[sortKey] ?? "";
        bVal = b[sortKey] ?? "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    filteredRows,
    sortKey,
    sortDir,
    parseDateStr,
    getLastActionAt,
    getIlaclar,
    getAnalysisInfo,
  ]);

  // Pagination
  const totalPages = sortedRows.length
    ? Math.ceil(sortedRows.length / pageSize)
    : 0;
  const paginatedRows = useMemo(() => {
    if (!sortedRows.length) return [];
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const isAllSelected =
    rows.length > 0 && selectedRecetes.length === rows.length;
  const isSomeSelected =
    selectedRecetes.length > 0 && selectedRecetes.length < rows.length;

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

  // Find row data for sheet
  const sheetRow = analizSheetReceteNo
    ? rows.find((r) => r.receteNo === analizSheetReceteNo)
    : null;
  const sheetIlaclar = sheetRow
    ? getIlaclar(sheetRow)
    : analizSheetReceteNo
      ? detaylar[analizSheetReceteNo]?.ilaclar
      : undefined;

  const compactClasses = compact
    ? "[&_td]:py-2 [&_td]:px-3 [&_th]:py-2 [&_th]:px-3 [&_th]:h-auto"
    : "";

  return (
    <>
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={activeFilter === filter ? "default" : "outline"}
              onClick={() => {
                setActiveFilter(filter);
                onPageChange(1);
              }}
              className="h-7 text-xs"
            >
              {getFilterLabel(filter)}
            </Button>
          ))}
        </div>
      )}

      <Table className={compactClasses}>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                  ref={(checkbox: HTMLButtonElement | null) => {
                    if (checkbox) {
                      (checkbox as unknown as { indeterminate: boolean }).indeterminate = isSomeSelected;
                    }
                  }}
                />
              </TableHead>
            )}
            <SortableHead label="Reçete No" column="receteNo" />
            {showHasta && <SortableHead label="Hasta" column="ad" />}
            <SortableHead label="Reçete Tarihi" column="receteTarihi" />
            {showSonIslemTarihi && (
              <SortableHead
                label="Son İşlem Tarihi"
                column="sonIslemTarihi"
              />
            )}
            <TableHead>İlaç Sayısı</TableHead>
            {showKayitTarihi && (
              <SortableHead label="Kayıt Tarihi" column="cachedAt" />
            )}
            <SortableHead
              label="Analiz Edildi"
              column="analizEdildi"
              className="text-center"
            />
            <TableHead className="text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRows.map((row) => {
            const ilaclar = getIlaclar(row);
            const hasCachedDetail = !!detaylar[row.receteNo];
            const isLoadingDetail = loadingRecete === row.receteNo;
            const isAnalyzing = analyzingRecete === row.receteNo;
            const within45 = isWithin45Days
              ? isWithin45Days(row.sonIslemTarihi || row.receteTarihi)
              : true;

            const { analyzedCount, totalRaporlu, hasAnalysis, isPartiallyAnalyzed, analyzedBarkods } =
              getAnalysisInfo(row.receteNo, ilaclar);
            const analysisStatus = hasAnalysis ? getAnalysisStatus(analyzedBarkods) : undefined;

            const ilacCount = ilaclar?.length;
            const hasIlacData = ilacCount != null;

            return (
              <TableRow key={row.receteNo}>
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={selectedRecetes.includes(row.receteNo)}
                      onCheckedChange={(checked) =>
                        onSelectRecete?.(row.receteNo, !!checked)
                      }
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">{row.receteNo}</TableCell>
                {showHasta && (
                  <TableCell>
                    {row.ad} {row.soyad}
                  </TableCell>
                )}
                <TableCell>{row.receteTarihi}</TableCell>
                {showSonIslemTarihi && (
                  <TableCell className="text-muted-foreground text-sm">
                    {(() => {
                      if (getLastActionAt && row.cachedAt != null) {
                        const ts = getLastActionAt(row.receteNo, row.cachedAt);
                        const d = new Date(ts);
                        return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
                      }
                      return row.sonIslemTarihi ?? "—";
                    })()}
                  </TableCell>
                )}

                {/* İlaç Sayısı */}
                <TableCell>
                  {hasIlacData ? (
                    <div className="flex items-center gap-1.5">
                      <span>{ilacCount}</span>
                      {totalRaporlu > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0"
                        >
                          {totalRaporlu} raporlu
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>

                {showKayitTarihi && (
                  <TableCell className="text-muted-foreground text-sm">
                    {row.cachedAt != null
                      ? (() => {
                          const d = new Date(row.cachedAt);
                          return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
                        })()
                      : "—"}
                  </TableCell>
                )}

                {/* Analiz Edildi */}
                <TableCell className="text-center">
                  {isAnalyzing ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                  ) : hasAnalysis ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              setAnalizSheetReceteNo(row.receteNo)
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
                              <Eye className={`h-5 w-5 ${statusIconColor[analysisStatus!]}`} />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isPartiallyAnalyzed
                            ? `${analyzedCount}/${totalRaporlu} raporlu ilaç analiz edildi`
                            : statusTooltip[analysisStatus!]}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Circle className="mx-auto h-5 w-5 text-muted-foreground/30" />
                  )}
                </TableCell>

                {/* İşlemler */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasCachedDetail && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDetay(row.receteNo)}
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
                            onSorgula(row.receteNo, hasCachedDetail)
                          }
                          disabled={isBusy}
                        >
                          {isLoadingDetail ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Database className="h-4 w-4" />
                          )}
                          {hasCachedDetail ? "Yeniden Sorgula" : "Sorgula"}
                        </Button>
                        <Button
                          size="sm"
                          variant={hasAnalysis ? "outline" : "default"}
                          onClick={() =>
                            onAnalizEt(row.receteNo, hasAnalysis)
                          }
                          disabled={isBusy}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                          {hasAnalysis ? "Yeniden Kontrol Et" : "Kontrol Et"}
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
            {filteredRows.length} kayıttan {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, filteredRows.length)} arası
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
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
              onClick={() => onPageChange(currentPage + 1)}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Analysis results sheet */}
      <Sheet
        open={!!analizSheetReceteNo}
        onOpenChange={(open) => !open && setAnalizSheetReceteNo(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kontrol Sonucu</SheetTitle>
            <SheetDescription>
              Reçete: {analizSheetReceteNo}
              {sheetRow?.ad && (
                <span className="block">Hasta: {sheetRow.ad} {sheetRow.soyad}</span>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <KontrolSonucPanel
              receteNo={analizSheetReceteNo || ""}
              sonuclar={
                analizSheetReceteNo
                  ? (analizSonuclari[analizSheetReceteNo] ?? {})
                  : {}
              }
              ilaclar={sheetIlaclar}
              onReAnalyze={() =>
                analizSheetReceteNo &&
                (onReAnalyze
                  ? onReAnalyze(analizSheetReceteNo)
                  : onAnalizEt(analizSheetReceteNo, true))
              }
              isReAnalyzing={
                analizSheetReceteNo
                  ? isReAnalyzing
                    ? isReAnalyzing(analizSheetReceteNo)
                    : analyzingRecete === analizSheetReceteNo
                  : false
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
