import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronUp,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Eye,
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

function GroupSection({ group, onShowResult }: { group: TaskGroup; onShowResult?: (receteNo: string) => void }) {
  const doneCount = group.items.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const total = group.items.length;
  const allGroupDone = doneCount === total;
  const runningItem = group.items.find((i) => i.status === "running");
  const nextPending = group.items.find((i) => i.status === "pending");

  return (
    <div className="border-t first:border-t-0 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate">{group.title}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {doneCount}/{total}
          </span>
          {allGroupDone && group.receteNo && onShowResult && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => onShowResult(group.receteNo!)}
            >
              <Eye className="h-3 w-3 mr-0.5" />
              Sonucu Gör
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {group.items.map((item) => (
          <div
            key={item.id}
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
            {item.errorMessage && (
              <span
                className="truncate text-[10px] text-red-400"
                title={item.errorMessage}
              >
                {item.errorMessage}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Show "next up" hint when something is running and there's a pending item */}
      {runningItem && nextPending && (
        <div className="mt-1 px-2 text-[10px] text-muted-foreground">
          Sirada: {nextPending.label}
        </div>
      )}
    </div>
  );
}

export function GlobalTaskPanel() {
  const dispatch = useAppDispatch();
  const groups = useAppSelector((s) => s.taskQueue.groups);
  const [isOpen, setIsOpen] = useState(true);
  const [visible, setVisible] = useState(false);

  const allItems = groups.flatMap((g) => g.items);
  const totalItems = allItems.length;
  const doneItems = allItems.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const hasError = allItems.some((i) => i.status === "error");
  const runningItem = allItems.find((i) => i.status === "running");
  const pendingCount = allItems.filter((i) => i.status === "pending").length;

  // Show panel when groups exist
  useEffect(() => {
    if (groups.length > 0) {
      setVisible(true);
      setIsOpen(true);
    }
  }, [groups.length]);

  // Auto-hide after all done (10 seconds)
  useEffect(() => {
    if (!allDone || !visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      dispatch(clearCompleted());
    }, 10000);
    return () => clearTimeout(timer);
  }, [allDone, visible, dispatch]);

  const handleShowResult = (receteNo: string) => {
    dispatch(setShowResultReceteNo(receteNo));
  };

  if (!visible || groups.length === 0) return null;

  // Summary text for collapsed header
  const headerText = allDone
    ? hasError
      ? "Tamamlandi (hata var)"
      : "Tamamlandi"
    : runningItem
      ? runningItem.label
      : `Islem bekleniyor (${pendingCount})`;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[100] w-80 rounded-lg border bg-background shadow-xl transition-opacity duration-300",
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 rounded-t-lg">
          <span className="flex items-center gap-2 min-w-0">
            {!allDone && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            )}
            {allDone && !hasError && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
            )}
            {allDone && hasError && (
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )}
            <span className="truncate">{headerText}</span>
            {!allDone && totalItems > 1 && (
              <span className="text-xs text-muted-foreground shrink-0">
                ({doneItems}/{totalItems})
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {allDone && (
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
          <div className="max-h-64 overflow-y-auto border-t">
            {groups.map((group) => (
              <GroupSection key={group.id} group={group} onShowResult={handleShowResult} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
