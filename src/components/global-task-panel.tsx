import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Eye,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import { useAppSelector, useAppDispatch } from "@/store";
import { removeGroup, clearCompleted, setShowResultReceteNo } from "@/store/slices/taskQueueSlice";
import type { TaskItem, TaskGroup } from "@/store/slices/taskQueueSlice";

function StatusIcon({ status }: { status: TaskItem["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-3 w-3 text-muted-foreground/60" />;
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
  }
}

function GroupStatusIcon({ group }: { group: TaskGroup }) {
  const allDone = group.items.every((i) => i.status === "done" || i.status === "error");
  const hasError = group.items.some((i) => i.status === "error");
  const isRunning = group.items.some((i) => i.status === "running");

  if (isRunning) return <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />;
  if (allDone && hasError) return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
  if (allDone) return <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />;
  return <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
}

function GroupSection({
  group,
  onShowResult,
  onRetry,
  onRemove,
}: {
  group: TaskGroup;
  onShowResult?: (receteNo: string) => void;
  onRetry?: (groupId: string, receteNo?: string) => void;
  onRemove?: (groupId: string) => void;
}) {
  const doneCount = group.items.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const total = group.items.length;
  const allGroupDone = doneCount === total;
  const hasError = group.items.some((i) => i.status === "error");
  const isRunning = group.items.some((i) => i.status === "running");
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when there's an error
  useEffect(() => {
    if (hasError && allGroupDone) setExpanded(true);
  }, [hasError, allGroupDone]);

  return (
    <div className="border-t first:border-t-0">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/30">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                expanded && "rotate-90",
              )}
            />
            <GroupStatusIcon group={group} />
            <span className="text-xs font-medium truncate flex-1">{group.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {doneCount}/{total}
            </span>
          </CollapsibleTrigger>
          {isRunning && onRemove && (
            <button
              className="p-0.5 rounded hover:bg-destructive/10 shrink-0"
              title="Durdur"
              onClick={() => onRemove(group.id)}
            >
              <StopCircle className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
          {allGroupDone && hasError && onRetry && (
            <Button
              variant="destructive"
              className="h-8 px-3 text-xs font-semibold shrink-0"
              onClick={() => onRetry(group.id, group.receteNo)}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Tekrar Dene
            </Button>
          )}
          {allGroupDone && !hasError && group.receteNo && onShowResult && (
            <Button
              className="h-8 px-3 text-xs font-semibold shrink-0"
              onClick={() => {
                onShowResult(group.receteNo!);
                onRemove?.(group.id);
              }}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Sonucu Gör
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="pl-5 pr-3 pb-2 space-y-1">
            {group.items.map((item) => (
              <div key={item.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1 text-xs",
                    item.status === "running" && "bg-primary/5",
                  )}
                >
                  <StatusIcon status={item.status} />
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
                  {item.status === "running" && (
                    <span className="text-[10px] text-primary font-medium shrink-0">
                      devam ediyor
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="text-[10px] text-red-400 shrink-0">
                      başarısız
                    </span>
                  )}
                </div>
                {item.status === "error" && item.errorMessage && (
                  <div className="ml-7 mt-0.5 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 text-[10px] text-red-500">
                    {item.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function GlobalTaskPanel() {
  const dispatch = useAppDispatch();
  // Deeplink-triggered runs are surfaced via the separate task-panel window;
  // the in-app bottom-right panel only shows in-app work to avoid duplication.
  const groups = useAppSelector((s) =>
    s.taskQueue.groups.filter((g) => !g.id.startsWith("deeplink-")),
  );
  const bulkProgress = useAppSelector((s) => s.recete.bulkProgress);
  const [isOpen, setIsOpen] = useState(true);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  const allItems = groups.flatMap((g) => g.items);
  const totalItems = allItems.length;
  const doneItems = allItems.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const hasError = allItems.some((i) => i.status === "error");
  const runningItem = allItems.find((i) => i.status === "running");
  const pendingCount = allItems.filter((i) => i.status === "pending").length;

  const hasBulk = bulkProgress !== null;
  const hasContent = groups.length > 0 || hasBulk;

  // Auto-expand when new content arrives
  useEffect(() => {
    if (hasContent) {
      setIsOpen(true);
    }
  }, [hasContent]);

  // Reset cancelling state when bulk finishes
  useEffect(() => {
    if (!hasBulk) {
      setBulkCancelling(false);
    }
  }, [hasBulk]);

  const handleShowResult = (receteNo: string) => {
    dispatch(setShowResultReceteNo(receteNo));
  };

  const handleRetry = (groupId: string, receteNo?: string) => {
    dispatch(removeGroup(groupId));
    if (receteNo) {
      window.dispatchEvent(
        new CustomEvent("kolayrapor:retry-analysis", { detail: { receteNo } }),
      );
    }
  };

  const handleBulkCancel = () => {
    setBulkCancelling(true);
    window.dispatchEvent(new CustomEvent("kolayrapor:bulk-cancel"));
  };

  if (!hasContent) return null;

  // Summary text for collapsed header
  const headerText: string = hasBulk
    ? bulkCancelling
      ? "Durduruluyor..."
      : bulkProgress.type === "verileriAl"
        ? "Toplu sorgulama"
        : "Toplu kontrol"
    : allDone
      ? hasError
        ? "Tamamlandı (hata var)"
        : "Tamamlandı"
      : runningItem
        ? runningItem.label
        : `İşlem bekleniyor (${pendingCount})`;

  return createPortal(
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[200] pointer-events-auto w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] rounded-lg border bg-background shadow-xl transition-opacity duration-300",
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 rounded-t-lg">
          <span className="flex items-center gap-2 min-w-0">
            {(hasBulk && !bulkCancelling) || (!allDone && !hasBulk) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            ) : hasBulk && bulkCancelling ? (
              <StopCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            ) : allDone && !hasError ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
            ) : allDone && hasError ? (
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            ) : null}
            <span className="truncate">{headerText}</span>
            {hasBulk && (
              <span className="text-xs text-muted-foreground shrink-0">
                ({bulkProgress.current}/{bulkProgress.total})
              </span>
            )}
            {!hasBulk && !allDone && totalItems > 1 && (
              <span className="text-xs text-muted-foreground shrink-0">
                ({doneItems}/{totalItems})
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
            {!hasBulk && allDone && (
              <button
                className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(clearCompleted());
                }}
                title="Kapat"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="max-h-72 overflow-y-auto border-t">
            {/* Bulk progress section */}
            {hasBulk && (
              <div className="px-3 py-2.5 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {bulkProgress.type === "verileriAl"
                      ? "Veriler alınıyor..."
                      : "Kontrol ediliyor..."}
                  </span>
                  <div className="flex items-center gap-1">
                    {bulkCancelling ? (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-[10px]"
                          disabled
                        >
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Durduruluyor...
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent("kolayrapor:bulk-force-stop"));
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Zorla Durdur
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 px-2 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBulkCancel();
                        }}
                      >
                        <StopCircle className="h-3 w-3 mr-1" />
                        Durdur
                      </Button>
                    )}
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      bulkCancelling ? "bg-orange-400" : "bg-brand",
                    )}
                    style={{
                      width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  İşleniyor: {bulkProgress.currentReceteNo}
                </p>
              </div>
            )}

            {/* Individual task groups — each collapsible */}
            {groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                onShowResult={handleShowResult}
                onRetry={handleRetry}
                onRemove={(id) => dispatch(removeGroup(id))}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>,
    document.body,
  );
}
