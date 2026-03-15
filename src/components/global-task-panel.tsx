import { useEffect, useState } from "react";
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
}: {
  group: TaskGroup;
  onShowResult?: (receteNo: string) => void;
  onRetry?: (groupId: string, receteNo?: string) => void;
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
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/30 text-left">
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
          {allGroupDone && hasError && onRetry && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(group.id, group.receteNo);
              }}
            >
              <RefreshCw className="h-3 w-3 mr-0.5" />
              Tekrar Dene
            </Button>
          )}
          {allGroupDone && !hasError && group.receteNo && onShowResult && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                onShowResult(group.receteNo!);
              }}
            >
              <Eye className="h-3 w-3 mr-0.5" />
              Sonucu Gör
            </Button>
          )}
        </CollapsibleTrigger>

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
  const groups = useAppSelector((s) => s.taskQueue.groups);
  const bulkProgress = useAppSelector((s) => s.recete.bulkProgress);
  const [isOpen, setIsOpen] = useState(true);
  const [visible, setVisible] = useState(false);
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

  // Show panel when groups or bulk progress exist
  useEffect(() => {
    if (hasContent) {
      setVisible(true);
      setIsOpen(true);
    }
  }, [hasContent]);

  // Reset cancelling state when bulk finishes
  useEffect(() => {
    if (!hasBulk) {
      setBulkCancelling(false);
    }
  }, [hasBulk]);

  // Auto-hide after all done (10 seconds) — only if no errors and no bulk
  useEffect(() => {
    if (!allDone || !visible || hasError || hasBulk) return;
    const timer = setTimeout(() => {
      setVisible(false);
      dispatch(clearCompleted());
    }, 10000);
    return () => clearTimeout(timer);
  }, [allDone, visible, hasError, hasBulk, dispatch]);

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

  if (!visible || !hasContent) return null;

  // Summary text for collapsed header
  const headerText = hasBulk
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

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[100] w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] rounded-lg border bg-background shadow-xl transition-opacity duration-300",
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
            {!hasBulk && allDone && (
              <button
                className="p-0.5 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible(false);
                  dispatch(clearCompleted());
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
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
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 px-2 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkCancel();
                    }}
                    disabled={bulkCancelling}
                  >
                    {bulkCancelling ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Durduruluyor...
                      </>
                    ) : (
                      <>
                        <StopCircle className="h-3 w-3 mr-1" />
                        Durdur
                      </>
                    )}
                  </Button>
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
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
