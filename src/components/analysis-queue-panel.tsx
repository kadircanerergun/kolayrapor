import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronUp, ChevronDown, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/utils/tailwind";

export interface QueueItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
}

interface AnalysisQueuePanelProps {
  items: QueueItem[];
  visible: boolean;
  onHidden?: () => void;
}

export function AnalysisQueuePanel({ items, visible, onHidden }: AnalysisQueuePanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [show, setShow] = useState(false);

  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;
  const total = items.length;
  const allDone = total > 0 && doneCount === total;
  const hasError = items.some((i) => i.status === "error");
  const runningItem = items.find((i) => i.status === "running");

  // Show/hide with fade
  useEffect(() => {
    if (visible && total > 0) {
      setShow(true);
      setIsOpen(true);
    }
  }, [visible, total]);

  // Auto-hide after all items complete
  useEffect(() => {
    if (!allDone || !show) return;
    const timer = setTimeout(() => {
      setShow(false);
      onHidden?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [allDone, show, onHidden]);

  if (!show || total === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-50 w-72 rounded-lg border bg-background shadow-lg transition-opacity duration-300",
        allDone && "opacity-80",
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-t-lg">
          <span className="flex items-center gap-2">
            {!allDone && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {allDone && !hasError && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
            {allDone && hasError && <XCircle className="h-3.5 w-3.5 text-red-500" />}
            <span>
              {allDone
                ? hasError
                  ? "Analiz tamamlandı (hata var)"
                  : "Analiz tamamlandı"
                : runningItem
                  ? runningItem.label
                  : `Analiz ediliyor... (${doneCount}/${total})`}
            </span>
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="max-h-48 overflow-y-auto border-t px-1 py-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
              >
                <StatusIcon status={item.status} />
                <span
                  className={cn(
                    "flex-1 truncate",
                    item.status === "pending" && "text-muted-foreground",
                    item.status === "error" && "text-red-500",
                  )}
                >
                  {item.label}
                </span>
                {item.errorMessage && (
                  <span className="truncate text-[10px] text-red-400" title={item.errorMessage}>
                    {item.errorMessage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  switch (status) {
    case "pending":
      return <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />;
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
  }
}
