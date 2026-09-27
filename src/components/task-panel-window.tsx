import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import logoSrc from "../../images/logo-transparent.svg";

interface DeeplinkNotificationResult {
  barkod: string;
  label: string;
  validityScore?: number;
  failed?: boolean;
}

interface DeeplinkNotification {
  id: string;
  receteNo: string;
  patientName: string;
  status: "running" | "done";
  message?: string;
  results?: DeeplinkNotificationResult[];
}

interface TaskPanelState {
  notification: DeeplinkNotification | null;
}

type ValidityTier = "green" | "orange" | "red";

const taskPanelAPI = (window as any).taskPanelAPI;

function sendAction(action: { type: string; payload?: any }) {
  taskPanelAPI?.sendAction(action);
}

/** The running phase stays on screen for the whole check — it shrinks to a
 *  compact pill so it doesn't cover other apps, but hiding it made failures
 *  hard to notice, so it now lives until the results replace it. */
const RUNNING_WIDTH = 84;

/** Full width for the result panel, which lists one row per medicine. */
const DONE_WIDTH = 340;

/** When every medicine came back "Uygun" there is nothing to act on, so the
 *  result popup closes itself. Anything else waits to be dismissed. */
const ALL_CLEAR_CLOSE_MS = 8000;

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

function TierIcon({ tier }: { tier: ValidityTier | null }) {
  if (tier === "green")
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />;
  if (tier === "orange")
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />;
  if (tier === "red")
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

export function TaskPanelWindow() {
  const [notification, setNotification] = useState<DeeplinkNotification | null>(
    null,
  );

  useEffect(() => {
    // Drop the opaque app background so the transparent window shows only the
    // rounded card, with no white edge around it.
    document.body.classList.add("task-panel-window");
    taskPanelAPI?.onState((newState: TaskPanelState) => {
      setNotification(newState?.notification ?? null);
    });
  }, []);

  const status = notification?.status;
  const results = notification?.results ?? [];
  const scored = results.filter((r) => !r.failed && r.validityScore !== undefined);
  const failedCount = results.filter((r) => r.failed).length;
  const worstTier: ValidityTier | null = scored.some(
    (r) => scoreTier(r.validityScore) === "red",
  )
    ? "red"
    : scored.some((r) => scoreTier(r.validityScore) === "orange")
      ? "orange"
      : scored.length > 0
        ? "green"
        : null;
  const allClear =
    status === "done" &&
    failedCount === 0 &&
    !notification?.message &&
    worstTier === "green";

  // Keyed on id+phase so a re-sent (identical) state never re-triggers the
  // show/hide cycle, while each real phase change does.
  const phaseKey = notification ? `${notification.id}:${status}` : null;

  // Show the running pill and leave it up until the check finishes — a hidden
  // panel meant a failed automated check went unnoticed.
  useEffect(() => {
    if (!phaseKey || status !== "running") return;
    sendAction({ type: "showPanel" });
  }, [phaseKey, status]);

  // Bring the panel back for the results — this is what the user actually
  // needs to see when the main window sits hidden in the tray.
  useEffect(() => {
    if (!phaseKey || status !== "done") return;
    sendAction({ type: "showPanel" });
    if (!allClear) return;
    const timer = setTimeout(() => {
      sendAction({ type: "closePanel" });
    }, ALL_CLEAR_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phaseKey, status, allClear]);

  // Auto-resize the window to fit the content. The running pill is narrow and
  // the result panel is full width, so the width is driven by the phase.
  const contentRef = useRef<HTMLDivElement>(null);
  const width = status === "running" ? RUNNING_WIDTH : DONE_WIDTH;
  const resizeToFit = useCallback(() => {
    if (!contentRef.current) return;
    // Exact content height — any slack becomes a visible strip under the card.
    taskPanelAPI?.resize({
      width,
      height: Math.ceil(contentRef.current.getBoundingClientRect().height),
    });
  }, [width]);
  useEffect(() => {
    resizeToFit();
  }, [notification, resizeToFit]);
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => resizeToFit());
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [resizeToFit]);

  if (!notification) return null;

  const borderClass =
    status === "running"
      ? "border-brand bg-brand/10"
      : worstTier === "red"
        ? "border-red-500 bg-red-50 dark:bg-red-950/30"
        : worstTier === "orange"
          ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
          : worstTier === "green"
            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
            : "border-brand bg-brand/10";

  // Compact pill for the whole running phase: logo, spinner and a short label.
  // It stays on screen until the results replace it, so a check that fails or
  // stalls is visible instead of silently disappearing.
  if (status === "running") {
    return (
      <div ref={contentRef} className="bg-background rounded-lg">
        <div
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border-2 px-1.5 py-1.5 shadow-xl select-none",
            borderClass,
          )}
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <img src={logoSrc} alt="" className="h-5 w-5" />
          <Loader2 className="text-primary h-3 w-3 animate-spin" />
          <p className="text-center text-[10px] leading-tight font-semibold">
            İnceleniyor
          </p>
          {notification.patientName && (
            <p className="text-muted-foreground w-full truncate text-center text-[9px] leading-tight">
              {notification.patientName}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="bg-background rounded-lg">
      <div
        className={cn(
          "rounded-lg border-2 px-3 py-2.5 shadow-xl select-none",
          borderClass,
        )}
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            <TierIcon tier={worstTier} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">KolayRapor Kontrol Sonucu</p>
            {notification.patientName && (
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                {notification.patientName}
              </p>
            )}
          </div>
          <button
            onClick={() => sendAction({ type: "closePanel" })}
            className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 shrink-0 p-1"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            aria-label="Kapat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {status === "done" && (
          <div
            className="mt-2 space-y-1.5"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {notification.message ? (
              <p className="text-[11px]">{notification.message}</p>
            ) : (
              results.map((r) => {
                const tier = scoreTier(r.validityScore);
                return (
                  <div key={r.barkod} className="flex items-center gap-1.5">
                    <TierIcon tier={tier} />
                    <span className="min-w-0 flex-1 truncate text-[11px]">
                      {r.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold",
                        tier === "green" && "text-green-700 dark:text-green-400",
                        tier === "orange" &&
                          "text-orange-700 dark:text-orange-400",
                        tier === "red" && "text-red-700 dark:text-red-400",
                        !tier && "text-muted-foreground",
                      )}
                    >
                      {r.failed || !tier ? "Kontrol edilemedi" : tierLabel(tier)}
                    </span>
                  </div>
                );
              })
            )}

            {results.length > 0 && (
              <Button
                size="sm"
                className="mt-1 h-7 w-full text-xs"
                onClick={() => {
                  sendAction({
                    type: "showResult",
                    payload: notification.receteNo,
                  });
                  sendAction({ type: "closePanel" });
                }}
              >
                Detayları Gör
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
