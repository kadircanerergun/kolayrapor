import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import type { ReceteReportResponse } from "@/services/report-api";
import type { ReceteIlac } from "@/types/recete";

interface KontrolSonucPanelProps {
  receteNo: string;
  sonuclar: Record<string, ReceteReportResponse>;
  ilaclar?: ReceteIlac[];
  onReAnalyze?: (barkod?: string) => void;
  isReAnalyzing?: boolean;
  /** Barkod of the medicine to auto-expand when the panel opens */
  focusBarkod?: string;
}

function getScoreTier(score: number) {
  if (score >= 80) return { label: "Uygun", tier: "green" } as const;
  if (score >= 60) return { label: "Şüpheli", tier: "orange" } as const;
  return { label: "Uygun Değil", tier: "red" } as const;
}

function getLeftBorderColor(tier: "green" | "orange" | "red") {
  switch (tier) {
    case "green":
      return "border-l-green-500";
    case "orange":
      return "border-l-orange-400";
    case "red":
      return "border-l-red-500";
  }
}

function getBadgeClasses(tier: "green" | "orange" | "red") {
  switch (tier) {
    case "green":
      return "border-green-300 text-green-700";
    case "orange":
      return "border-orange-300 text-orange-700";
    case "red":
      return "border-red-300 text-red-700";
  }
}

export function KontrolSonucPanel({
  sonuclar,
  ilaclar,
  onReAnalyze,
  isReAnalyzing,
  focusBarkod,
}: KontrolSonucPanelProps) {
  const entries = Object.entries(sonuclar);

  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    if (focusBarkod) return new Set([focusBarkod]);
    if (entries.length === 1) return new Set([entries[0][0]]);
    return new Set<string>();
  });

  // When focusBarkod changes, ensure it's expanded
  const [prevFocusBarkod, setPrevFocusBarkod] = useState(focusBarkod);
  if (focusBarkod && focusBarkod !== prevFocusBarkod) {
    setPrevFocusBarkod(focusBarkod);
    setOpenItems((prev) => {
      if (prev.has(focusBarkod)) return prev;
      return new Set([...prev, focusBarkod]);
    });
  }

  const toggleItem = (barkod: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(barkod)) {
        next.delete(barkod);
      } else {
        next.add(barkod);
      }
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Henüz analiz sonucu yok.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([barkod, report]) => {
        const score = Math.round(report.validityScore ?? 0);
        const { label, tier } = getScoreTier(score);
        const isOpen = openItems.has(barkod);
        const medicineName =
          ilaclar?.find((m) => m.barkod === barkod)?.ad || barkod;

        return (
          <Collapsible
            key={barkod}
            open={isOpen}
            onOpenChange={() => toggleItem(barkod)}
          >
            <div
              className={cn(
                "rounded-lg border border-l-4 bg-card shadow-sm",
                getLeftBorderColor(tier),
              )}
            >
              {/* CARD HEADER */}
              <CollapsibleTrigger asChild>
                <button className="w-full p-3 flex items-center justify-between text-left">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {medicineName}
                    </p>
                    {medicineName !== barkod && (
                      <p className="text-xs text-muted-foreground">{barkod}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-semibold",
                        getBadgeClasses(tier),
                      )}
                    >
                      {score}% {label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>

              {/* CARD BODY */}
              <CollapsibleContent>
                <Separator />

                {/* Validity + Score */}
                <div className="px-3 py-2 flex items-center gap-2 text-sm">
                  {report.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {report.isValid ? "Geçerli" : "Geçersiz"}
                  </span>
                  <span className="text-muted-foreground">—</span>
                  <span>{score}%</span>
                </div>

                <Separator />

                {/* Report HTML details */}
                {report.reportEvolutionDetails && (
                  <>
                    <div className="px-3 py-3">
                      <div
                        className="text-sm leading-[1.4] prose prose-sm max-w-none
                          [&>*+*]:border-t [&>*+*]:border-border/40 [&>*+*]:pt-2 [&>*+*]:mt-2"
                        dangerouslySetInnerHTML={{
                          __html: report.reportEvolutionDetails,
                        }}
                      />
                    </div>
                    <Separator />
                  </>
                )}

                {/* Info: processedAt, pharmacyId */}
                <div className="px-3 py-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">İşlem Tarihi:</span>{" "}
                    {report.processedAt
                      ? new Date(report.processedAt).toLocaleString("tr-TR")
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Eczane ID:</span>{" "}
                    {report.pharmacyId || "—"}
                  </div>
                </div>

                {/* Re-analyze button */}
                {onReAnalyze && (
                  <div className="px-3 pb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => onReAnalyze(barkod)}
                      disabled={isReAnalyzing}
                    >
                      {isReAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Yeniden Kontrol Et
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
