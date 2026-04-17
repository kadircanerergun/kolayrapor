import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Eye,
  RefreshCw,
  StopCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface TaskItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
  isValid?: boolean;
  validityScore?: number;
}

interface TaskGroup {
  id: string;
  title: string;
  receteNo?: string;
  items: TaskItem[];
  createdAt: number;
}

interface BulkProgress {
  type: "verileriAl" | "analizEt";
  current: number;
  total: number;
  currentReceteNo: string;
}

interface TaskPanelState {
  groups: TaskGroup[];
  bulkProgress: BulkProgress | null;
}

type ValidityTier = "green" | "orange" | "red";

const taskPanelAPI = (window as any).taskPanelAPI;

function sendAction(action: { type: string; payload?: any }) {
  taskPanelAPI?.sendAction(action);
}

function scoreTier(score: number | undefined): ValidityTier | null {
  if (score === undefined) return null;
  if (score >= 80) return "green";
  if (score >= 60) return "orange";
  return "red";
}

function tierLabel(tier: ValidityTier) {
  switch (tier) {
    case "green":
      return "Uygun";
    case "orange":
      return "Şüpheli";
    case "red":
      return "Uygun Değil";
  }
}

function ValidityBadge({ tier }: { tier: ValidityTier }) {
  const styles: Record<ValidityTier, string> = {
    green:
      "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
    orange:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium leading-4",
        styles[tier],
      )}
    >
      {tierLabel(tier)}
    </span>
  );
}

function ItemStatusIcon({ item }: { item: TaskItem }) {
  if (item.status === "pending")
    return <Clock className="h-3 w-3 text-muted-foreground/60" />;
  if (item.status === "running")
    return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
  if (item.status === "error")
    return <XCircle className="h-3 w-3 text-red-500" />;
  // done
  const tier = scoreTier(item.validityScore);
  if (tier === "green")
    return <CheckCircle2 className="h-3 w-3 text-green-600" />;
  if (tier === "orange")
    return <AlertTriangle className="h-3 w-3 text-orange-500" />;
  if (tier === "red") return <XCircle className="h-3 w-3 text-red-500" />;
  return <CheckCircle2 className="h-3 w-3 text-green-600" />;
}

export function TaskPanelWindow() {
  const [state, setState] = useState<TaskPanelState>({
    groups: [],
    bulkProgress: null,
  });
  const [expanded, setExpanded] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  useEffect(() => {
    taskPanelAPI?.onState((newState: TaskPanelState) => {
      setState(newState);
    });
  }, []);

  const { groups, bulkProgress } = state;

  // Deeplink flow guarantees a single group at a time. Pick the most recent
  // just in case, so stale groups never dominate the UI.
  const group = groups.length
    ? [...groups].sort((a, b) => b.createdAt - a.createdAt)[0]
    : null;

  const items = group?.items ?? [];
  const medicineItems = items.filter((i) => i.id !== "fetch");
  const totalItems = items.length;
  const doneItems = items.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const hasError = items.some((i) => i.status === "error");
  const errorCount = items.filter((i) => i.status === "error").length;
  const runningItem = items.find((i) => i.status === "running");

  // Validity summary across medicine items (excluding the "fetch" step)
  const medicineDone = medicineItems.filter((i) => i.status === "done");
  const scoredMedicine = medicineDone.filter(
    (i) => i.validityScore !== undefined,
  );
  const greenCount = scoredMedicine.filter(
    (i) => scoreTier(i.validityScore) === "green",
  ).length;
  const orangeCount = scoredMedicine.filter(
    (i) => scoreTier(i.validityScore) === "orange",
  ).length;
  const redCount = scoredMedicine.filter(
    (i) => scoreTier(i.validityScore) === "red",
  ).length;
  const worstTier: ValidityTier | null =
    redCount > 0 ? "red" : orangeCount > 0 ? "orange" : greenCount > 0 ? "green" : null;

  const hasBulk = bulkProgress !== null;
  const hasContent = group !== null || hasBulk;

  useEffect(() => {
    if (!hasBulk) setBulkCancelling(false);
  }, [hasBulk]);

  // Auto-hide window 3s after first content appears (while still running),
  // then show again when tasks finish or encounter errors.
  const wasEverDone = useRef(false);
  const hasAutoHidden = useRef(false);

  useEffect(() => {
    if (allDone && totalItems > 0) wasEverDone.current = true;
  }, [allDone, totalItems]);

  useEffect(() => {
    // Don't auto-hide if tasks already finished
    if (!hasContent || allDone || wasEverDone.current) return;
    const timer = setTimeout(() => {
      hasAutoHidden.current = true;
      sendAction({ type: "hidePanel" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [hasContent, allDone]);

  // Show window again when tasks finish or encounter errors
  useEffect(() => {
    if (allDone && totalItems > 0 && hasAutoHidden.current) {
      hasAutoHidden.current = false;
      sendAction({ type: "showPanel" });
    }
  }, [allDone, totalItems]);

  // Auto-expand when done so the user can see validity per medicine at a glance
  useEffect(() => {
    if (allDone && medicineItems.length > 0) setExpanded(true);
  }, [allDone, medicineItems.length]);

  // Auto-resize window to fit content
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeToFit = useCallback(() => {
    if (!contentRef.current) return;
    const height = contentRef.current.scrollHeight;
    taskPanelAPI?.resize(Math.ceil(height) + 2);
  }, []);

  useEffect(() => {
    resizeToFit();
  }, [state, expanded, resizeToFit]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => resizeToFit());
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [resizeToFit]);

  if (!hasContent) {
    return null;
  }

  // Subtitle shown under the main header
  const subtitle: string | null = hasBulk
    ? bulkCancelling
      ? "Durduruluyor..."
      : bulkProgress!.type === "verileriAl"
        ? "Toplu sorgulama"
        : "Toplu kontrol"
    : allDone
      ? hasError
        ? `Tamamlandı — ${errorCount} hata`
        : scoredMedicine.length > 0
          ? worstTier === "green"
            ? `${greenCount}/${scoredMedicine.length} Uygun`
            : `${greenCount}/${scoredMedicine.length} uygun · ${orangeCount + redCount} sorunlu`
          : "Tamamlandı"
      : runningItem
        ? runningItem.label
        : "Hazırlanıyor...";

  const progressText =
    !hasBulk && totalItems > 1 && !allDone
      ? `${doneItems}/${totalItems}`
      : null;

  // Main title: the recete number for a deeplink flow, bulk label otherwise
  const title = hasBulk
    ? bulkProgress!.type === "verileriAl"
      ? "Toplu Sorgulama"
      : "Toplu Kontrol"
    : group?.receteNo
      ? `Reçete ${group.receteNo}`
      : group?.title ?? "İşlem";

  // Header-level icon — reflects validity when done so the user sees status instantly
  const headerIcon = (() => {
    if ((hasBulk && !bulkCancelling) || (!allDone && !hasBulk)) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />;
    }
    if (hasBulk && bulkCancelling) {
      return <StopCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
    }
    if (hasError) {
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    }
    if (worstTier === "red") {
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    }
    if (worstTier === "orange") {
      return (
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
      );
    }
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
  })();

  return (
    <div ref={contentRef} className="bg-transparent">
      <div className="rounded-lg border bg-background shadow-xl overflow-hidden">
        {/* Compact header — always visible */}
        <div
          className="flex items-start gap-2 px-3 py-2 cursor-move select-none"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="pt-0.5">{headerIcon}</div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate">{title}</span>
              {progressText && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {progressText}
                </span>
              )}
            </div>
            {subtitle && (
              <p
                className={cn(
                  "text-[10px] truncate mt-0.5",
                  hasError
                    ? "text-red-500"
                    : allDone && worstTier === "red"
                      ? "text-red-500 font-medium"
                      : allDone && worstTier === "orange"
                        ? "text-orange-600 font-medium"
                        : allDone && worstTier === "green"
                          ? "text-green-600 font-medium"
                          : "text-muted-foreground",
                )}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons in header */}
          <div
            className="flex items-center gap-1 shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Show result — opens main app */}
            {allDone && !hasError && group?.receteNo && (
              <button
                className="p-0.5 rounded hover:bg-muted"
                title="Sonucu Gör"
                onClick={() =>
                  sendAction({ type: "showResult", payload: group.receteNo })
                }
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
              </button>
            )}
            {/* Retry on error */}
            {allDone && hasError && group && (
              <button
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/30"
                title="Tekrar Dene"
                onClick={() =>
                  sendAction({
                    type: "retry",
                    payload: { groupId: group.id, receteNo: group.receteNo },
                  })
                }
              >
                <RefreshCw className="h-3.5 w-3.5 text-red-500" />
              </button>
            )}
            {/* Expand/collapse */}
            {group && items.length > 0 && (
              <button
                className="p-0.5 rounded hover:bg-muted"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            {/* Close */}
            <button
              className="p-0.5 rounded hover:bg-muted"
              onClick={() => sendAction({ type: "closePanel" })}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Bulk progress bar (always visible when active) */}
        {hasBulk && (
          <div className="px-3 pb-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  bulkCancelling ? "bg-orange-400" : "bg-brand",
                )}
                style={{
                  width: `${(bulkProgress!.current / bulkProgress!.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {bulkProgress!.currentReceteNo}
            </p>
            {!bulkCancelling ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-5 px-2 text-[10px] mt-1"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setBulkCancelling(true);
                  sendAction({ type: "bulkCancel" });
                }}
              >
                <StopCircle className="h-3 w-3 mr-1" />
                Durdur
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="h-5 px-2 text-[10px] mt-1"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => sendAction({ type: "bulkForceStop" })}
              >
                <X className="h-3 w-3 mr-1" />
                Zorla Durdur
              </Button>
            )}
          </div>
        )}

        {/* Expanded detail — task items for the single current group */}
        {expanded && group && items.length > 0 && (
          <div className="border-t max-h-60 overflow-y-auto">
            <div className="px-3 py-1.5 space-y-0.5">
              {items.map((item) => {
                const tier = scoreTier(item.validityScore);
                const clickable = item.status === "done" && !!group.receteNo;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 rounded px-2 py-1 text-xs",
                      clickable && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={() => {
                      if (clickable) {
                        sendAction({
                          type: "showResult",
                          payload: group.receteNo,
                        });
                      }
                    }}
                  >
                    <ItemStatusIcon item={item} />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        item.status === "pending" && "text-muted-foreground",
                        item.status === "error" && "text-red-500",
                        item.status === "running" && "font-medium",
                      )}
                    >
                      {item.label}
                    </span>
                    {item.status === "done" && tier && (
                      <ValidityBadge tier={tier} />
                    )}
                    {item.status === "error" && item.errorMessage && (
                      <span className="text-[10px] text-red-500 truncate max-w-[50%]">
                        {item.errorMessage}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
