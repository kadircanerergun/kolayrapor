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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface TaskItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
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

const taskPanelAPI = (window as any).taskPanelAPI;

function sendAction(action: { type: string; payload?: any }) {
  taskPanelAPI?.sendAction(action);
}

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

  const allItems = groups.flatMap((g) => g.items);
  const totalItems = allItems.length;
  const doneItems = allItems.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const hasError = allItems.some((i) => i.status === "error");
  const errorCount = allItems.filter((i) => i.status === "error").length;
  const runningItem = allItems.find((i) => i.status === "running");

  const hasBulk = bulkProgress !== null;
  const hasContent = groups.length > 0 || hasBulk;

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

  // Expand automatically when errors occur
  useEffect(() => {
    if (hasError && allDone) setExpanded(true);
  }, [hasError, allDone]);

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

  // Summary text for the header
  const headerText: string = hasBulk
    ? bulkCancelling
      ? "Durduruluyor..."
      : bulkProgress!.type === "verileriAl"
        ? "Toplu sorgulama"
        : "Toplu kontrol"
    : allDone
      ? hasError
        ? `Tamamlandı (${errorCount} hata)`
        : "Tamamlandı"
      : runningItem
        ? runningItem.label
        : "Hazırlanıyor...";

  const progressText = hasBulk
    ? `${bulkProgress!.current}/${bulkProgress!.total}`
    : totalItems > 1
      ? `${doneItems}/${totalItems}`
      : null;

  return (
    <div ref={contentRef} className="bg-transparent">
      <div className="rounded-lg border bg-background shadow-xl overflow-hidden">
        {/* Compact header — always visible */}
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-move select-none"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* Status icon */}
          {(hasBulk && !bulkCancelling) || (!allDone && !hasBulk) ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          ) : hasBulk && bulkCancelling ? (
            <StopCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          ) : allDone && !hasError ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}

          {/* Title + progress */}
          <span className="text-xs font-medium truncate flex-1">
            {headerText}
          </span>
          {progressText && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              ({progressText})
            </span>
          )}

          {/* Action buttons in header */}
          <div
            className="flex items-center gap-1 shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Show result — opens main app */}
            {allDone && !hasError && groups.length > 0 && groups[0].receteNo && (
              <button
                className="p-0.5 rounded hover:bg-muted"
                title="Sonucu Gör"
                onClick={() =>
                  sendAction({ type: "showResult", payload: groups[0].receteNo })
                }
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
              </button>
            )}
            {/* Retry on error */}
            {allDone && hasError && groups.length > 0 && (
              <button
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/30"
                title="Tekrar Dene"
                onClick={() =>
                  sendAction({
                    type: "retry",
                    payload: { groupId: groups[0].id, receteNo: groups[0].receteNo },
                  })
                }
              >
                <RefreshCw className="h-3.5 w-3.5 text-red-500" />
              </button>
            )}
            {/* Expand/collapse */}
            {groups.length > 0 && (
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

        {/* Expanded detail — task items */}
        {expanded && groups.length > 0 && (
          <div className="border-t max-h-60 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.id}>
                {groups.length > 1 && (
                  <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/30 border-b">
                    {group.title}
                  </div>
                )}
                <div className="px-3 py-1.5 space-y-0.5">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-0.5 text-xs",
                        item.status === "done" && "cursor-pointer hover:bg-muted/50",
                      )}
                      onClick={() => {
                        if (item.status === "done" && group.receteNo) {
                          sendAction({ type: "showResult", payload: group.receteNo });
                        }
                      }}
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
