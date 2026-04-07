import { useEffect, useRef, useState, useCallback } from "react";
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
  GripHorizontal,
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

function GroupStatusIcon({ group }: { group: TaskGroup }) {
  const allDone = group.items.every(
    (i) => i.status === "done" || i.status === "error",
  );
  const hasError = group.items.some((i) => i.status === "error");
  const isRunning = group.items.some((i) => i.status === "running");

  if (isRunning)
    return (
      <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
    );
  if (allDone && hasError)
    return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
  if (allDone)
    return <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />;
  return <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
}

function GroupSection({ group }: { group: TaskGroup }) {
  const doneCount = group.items.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const total = group.items.length;
  const allGroupDone = doneCount === total;
  const hasError = group.items.some((i) => i.status === "error");
  const isRunning = group.items.some((i) => i.status === "running");
  const [expanded, setExpanded] = useState(true);

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
          <span className="text-xs font-medium truncate flex-1">
            {group.title}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {doneCount}/{total}
          </span>
          {isRunning && (
            <button
              className="p-0.5 rounded hover:bg-destructive/10"
              title="Durdur"
              onClick={(e) => {
                e.stopPropagation();
                sendAction({ type: "removeGroup", payload: group.id });
              }}
            >
              <StopCircle className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
          {allGroupDone && hasError && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                sendAction({
                  type: "retry",
                  payload: { groupId: group.id, receteNo: group.receteNo },
                });
              }}
            >
              <RefreshCw className="h-3 w-3 mr-0.5" />
              Tekrar Dene
            </Button>
          )}
          {allGroupDone && !hasError && group.receteNo && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                sendAction({
                  type: "showResult",
                  payload: group.receteNo,
                });
              }}
            >
              <Eye className="h-3 w-3 mr-0.5" />
              Sonucu Gor
            </Button>
          )}
          {allGroupDone && (
            <button
              className="p-0.5 rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                sendAction({ type: "removeGroup", payload: group.id });
              }}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
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
                      basarisiz
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

export function TaskPanelWindow() {
  const [state, setState] = useState<TaskPanelState>({
    groups: [],
    bulkProgress: null,
  });
  const [isOpen, setIsOpen] = useState(true);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  useEffect(() => {
    console.log("[TaskPanelWindow] Registering onState listener, taskPanelAPI:", !!taskPanelAPI);
    taskPanelAPI?.onState((newState: TaskPanelState) => {
      console.log("[TaskPanelWindow] State received:", JSON.stringify(newState).substring(0, 500));
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
  const runningItem = allItems.find((i) => i.status === "running");
  const pendingCount = allItems.filter((i) => i.status === "pending").length;

  const hasBulk = bulkProgress !== null;
  const hasContent = groups.length > 0 || hasBulk;

  useEffect(() => {
    if (!hasBulk) setBulkCancelling(false);
  }, [hasBulk]);

  // Auto-resize window to fit content
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeToFit = useCallback(() => {
    if (!contentRef.current) return;
    const height = contentRef.current.scrollHeight;
    taskPanelAPI?.resize(Math.ceil(height) + 2);
  }, []);

  useEffect(() => {
    resizeToFit();
  }, [state, isOpen, resizeToFit]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => resizeToFit());
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [resizeToFit]);

  if (!hasContent) {
    return null;
  }

  const headerText: string = hasBulk
    ? bulkCancelling
      ? "Durduruluyor..."
      : bulkProgress!.type === "verileriAl"
        ? "Toplu sorgulama"
        : "Toplu kontrol"
    : allDone
      ? hasError
        ? "Tamamlandi (hata var)"
        : "Tamamlandi"
      : runningItem
        ? runningItem.label
        : `Islem bekleniyor (${pendingCount})`;

  return (
    <div ref={contentRef} className="bg-transparent">
      <div className="rounded-lg border bg-background shadow-xl overflow-hidden">
        {/* Draggable header area */}
        <div
          className="flex items-center justify-center py-1 cursor-move"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground/40" />
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50">
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
                  ({bulkProgress!.current}/{bulkProgress!.total})
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
              <button
                className="p-0.5 rounded hover:bg-muted"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  sendAction({ type: "closePanel" });
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="max-h-72 overflow-y-auto border-t">
              {hasBulk && (
                <div className="px-3 py-2.5 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {bulkProgress!.type === "verileriAl"
                        ? "Veriler aliniyor..."
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
                            onClick={() =>
                              sendAction({ type: "bulkForceStop" })
                            }
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
                          onClick={() => {
                            setBulkCancelling(true);
                            sendAction({ type: "bulkCancel" });
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
                        width: `${(bulkProgress!.current / bulkProgress!.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Isleniyor: {bulkProgress!.currentReceteNo}
                  </p>
                </div>
              )}

              {groups.map((group) => (
                <GroupSection key={group.id} group={group} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
