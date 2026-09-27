import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Coins,
  Sparkles,
} from "lucide-react";
import { subscriptionApiService } from "@/services/subscription-api";
import { useSubscription } from "@/hooks/useSubscription";
import type { PlanChangeOption } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const tl = (amount: number) =>
  `₺${Number(amount ?? 0).toFixed(2).replace(".", ",")}`;

const trDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("tr-TR") : "-";

interface PlanChangeDialogProps {
  /** Plan being switched to; the dialog prices it when it opens. */
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation step for a plan change, in the three shapes the server can
 * answer with: immediate + payment, immediate + free, and end-of-period.
 *
 * The offer is always re-fetched here rather than reused from the plan list —
 * the numbers depend on how much of the period is left, so an offer made a few
 * minutes ago can already be stale.
 */
export function PlanChangeDialog({
  planId,
  open,
  onOpenChange,
}: PlanChangeDialogProps) {
  const navigate = useNavigate();
  const { refresh } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [option, setOption] = useState<PlanChangeOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set when the server answered 409 and we redrew with a new amount. */
  const [repriced, setRepriced] = useState(false);

  const loadPreview = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const { option: fresh, error: previewError } =
      await subscriptionApiService.previewPlanChange(id);
    setOption(fresh);
    setError(fresh ? null : (previewError ?? "Plan bilgisi alınamadı."));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !planId) return;
    setOption(null);
    setRepriced(false);
    void loadPreview(planId);
  }, [open, planId, loadPreview]);

  /** Applies changes that need no card: free upgrades and every downgrade. */
  const handleApply = async () => {
    if (!option) return;
    setSubmitting(true);
    try {
      const result = await subscriptionApiService.changePlan(option.planId, {
        acknowledgedChargeAmount: option.chargeNowWithKdv,
      });

      // The offer moved while the dialog was open — redraw with the new
      // numbers and make the user confirm again. Nothing was charged.
      if (result.conflict) {
        setRepriced(true);
        if (result.freshOption) {
          setOption(result.freshOption);
        } else {
          await loadPreview(option.planId);
        }
        toast.warning(
          result.error ?? "Tutar güncellendi. Lütfen yeni tutarı onaylayın.",
        );
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? "Plan değişikliği başarısız oldu.");
        return;
      }

      await refresh();
      toast.success(
        result.scheduled
          ? `Planınız ${trDate(result.effectiveAt ?? option.effectiveAt)} tarihinde ${option.planName} olarak değişecek.`
          : `${option.planName} planına geçildi.`,
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToPayment = () => {
    if (!option) return;
    onOpenChange(false);
    navigate({
      to: "/odeme",
      search: { type: "plan-change", id: option.planId },
    });
  };

  const isDowngrade = option?.effect === "period_end";
  const isFreeUpgrade = Boolean(option && !option.requiresPayment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDowngrade ? (
              <CalendarClock className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {option ? option.planName : "Plan Değişikliği"}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Güncel tutar hesaplanıyor..."
              : isDowngrade
                ? "Bu değişiklik mevcut döneminizin sonunda uygulanır."
                : "Değişiklik onayladığınız anda geçerli olur."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && option && !option.available && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{option.reason ?? "Bu plana şu anda geçemezsiniz."}</span>
          </div>
        )}

        {!loading && option && option.available && (
          <div className="space-y-4">
            {repriced && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Tutar güncellendi. Ödeme alınmadı — aşağıdaki yeni tutarı
                  onaylamanız gerekiyor.
                </span>
              </div>
            )}

            {isDowngrade ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geçiş tarihi</span>
                  <span className="font-medium">
                    {trDate(option.effectiveAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Yeni dönem ücreti
                  </span>
                  <span className="font-medium">{tl(option.priceWithKdv)}</span>
                </div>
                <Separator />
                <p className="text-muted-foreground">
                  Bugün herhangi bir ücret alınmaz ve mevcut planınız{" "}
                  {trDate(option.effectiveAt)} tarihine kadar aynen devam eder.
                  Yeni ücret ilk yenilemede tahsil edilir. Bu tarihe kadar
                  değişikliği iptal edebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Yeni plan (KDV dahil)
                  </span>
                  <span className="font-medium">{tl(option.priceWithKdv)}</span>
                </div>
                {option.proratedDiscount > 0 && (
                  <div className="flex justify-between text-green-700 dark:text-green-400">
                    <span>Mevcut planınızın kullanılmayan süresi</span>
                    <span className="font-medium">
                      −{tl(option.proratedDiscount)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Şimdi ödenecek</span>
                  <span className="text-2xl font-bold">
                    {tl(option.chargeNowWithKdv)}
                  </span>
                </div>

                {isFreeUpgrade && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Ek ödeme gerekmiyor
                  </Badge>
                )}

                {option.bonusCredits > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                    <Coins className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Kalan kredi döneminiz için{" "}
                      <span className="font-medium text-foreground">
                        {option.bonusCredits} kredi
                      </span>{" "}
                      hesabınıza eklenecek. Mevcut krediniz korunur.
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Yeni dönem sonu</span>
                  <span className="font-medium">
                    {trDate(option.newEndDate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Vazgeç
          </Button>
          {option?.available && (
            <Button
              onClick={
                option.requiresPayment ? handleGoToPayment : handleApply
              }
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  İşleniyor...
                </>
              ) : option.requiresPayment ? (
                <>
                  Ödemeye Geç
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : isDowngrade ? (
                "Değişikliği Planla"
              ) : (
                "Planı Yükselt"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
