import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { subscriptionApiService } from "@/services/subscription-api";
import { useSubscription } from "@/hooks/useSubscription";
import type { PendingPlanChange } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface PendingPlanChangeBannerProps {
  /** Falls back to the context value, which the store screens already hold. */
  pendingChange?: PendingPlanChange | null;
  onCancelled?: () => void;
}

/**
 * A downgrade is not applied when it is requested — it waits for the renewal.
 * Without this strip the licence screen would keep showing the old plan with no
 * sign that anything is about to change.
 */
export function PendingPlanChangeBanner({
  pendingChange,
  onCancelled,
}: PendingPlanChangeBannerProps) {
  const { pendingChange: contextPending, refresh } = useSubscription();
  const pending = pendingChange ?? contextPending;
  const [cancelling, setCancelling] = useState(false);

  if (!pending) return null;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const result = await subscriptionApiService.cancelPendingPlanChange();
      if (!result.success) {
        toast.error(result.error ?? "Planlanmış değişiklik iptal edilemedi.");
        return;
      }
      toast.success("Planlanmış değişiklik iptal edildi.");
      await refresh();
      onCancelled?.();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-300">
              Planlanmış plan değişikliği
            </p>
            <p className="mt-1 text-blue-800/80 dark:text-blue-400/80">
              {new Date(pending.effectiveAt).toLocaleDateString("tr-TR")}{" "}
              tarihinde{" "}
              <span className="font-medium">{pending.planName}</span> planına
              geçilecek. O tarihe kadar mevcut planınız aynen devam eder.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <>
              <Spinner size="sm" className="mr-2" />
              İptal ediliyor...
            </>
          ) : (
            "Değişikliği İptal Et"
          )}
        </Button>
      </div>
    </div>
  );
}
