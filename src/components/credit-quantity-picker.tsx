import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { subscriptionApiService } from "@/services/subscription-api";
import type { DynamicPlanFields, PlanQuote } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/utils/tailwind";

const QUOTE_DEBOUNCE_MS = 350;

export const tl = (amount: number) =>
  `₺${Number(amount ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const isDynamicPlan = (plan?: DynamicPlanFields | null) =>
  plan?.pricingModel === "dynamic";

/** The smallest amount a dynamic plan can be bought at. */
export const minCreditsOf = (plan: DynamicPlanFields) =>
  Number(plan.minCredits ?? plan.creditStep ?? 1);

/**
 * Pulls an amount onto the plan's grid: inside [minCredits, maxCredits] and a
 * whole number of `creditStep`s away from `minCredits`. The server rejects
 * anything else, so the picker never offers it.
 */
export function snapCredits(plan: DynamicPlanFields, value: number): number {
  const min = minCreditsOf(plan);
  const step = Math.max(1, Number(plan.creditStep ?? 1));
  const max = plan.maxCredits ?? null;
  if (!Number.isFinite(value)) return min;

  let snapped = min + Math.round((value - min) / step) * step;
  if (max !== null && snapped > max) {
    snapped = min + Math.floor((max - min) / step) * step;
  }
  return Math.max(min, snapped);
}

/**
 * The server's price for a plan at the chosen amount, re-asked (debounced)
 * whenever the amount changes. Nothing here is calculated locally.
 */
export function usePlanQuote(
  planId: string | null | undefined,
  creditQuantity: number | null | undefined,
) {
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!planId) {
      setQuote(null);
      setError(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await subscriptionApiService.getQuote(
        planId,
        creditQuantity,
      );
      // A slower answer for an amount the user has already moved past.
      if (id !== requestId.current) return;
      setQuote(result.quote);
      setError(result.quote ? null : (result.error ?? "Fiyat hesaplanamadı"));
      setLoading(false);
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [planId, creditQuantity]);

  // While a new amount is being priced, the previous figure is stale — hide it
  // rather than show a total that does not belong to the amount on screen.
  const current =
    quote &&
    quote.planId === planId &&
    (creditQuantity == null || quote.creditQuantity === creditQuantity)
      ? quote
      : null;

  return { quote: current, error: loading ? null : error, loading };
}

interface CreditQuantityPickerProps {
  plan: DynamicPlanFields;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Stepper + slider over a dynamic plan's allowed credit amounts. */
export function CreditQuantityPicker({
  plan,
  value,
  onChange,
  disabled,
  className,
}: CreditQuantityPickerProps) {
  const min = minCreditsOf(plan);
  const max = plan.maxCredits ?? null;
  const step = Math.max(1, Number(plan.creditStep ?? 1));
  // Typed freely, snapped onto the grid when the field is left.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => onChange(snapCredits(plan, next));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Aylık kredi miktarı</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Kredi miktarını azalt"
            disabled={disabled || value <= min}
            onClick={() => commit(value - step)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Aylık kredi miktarı"
            className="h-8 w-20 rounded-md border bg-background px-2 text-center text-sm font-medium tabular-nums"
            value={draft ?? String(value)}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              if (draft !== null && draft !== "") commit(Number(draft));
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Kredi miktarını artır"
            disabled={disabled || (max !== null && value + step > max)}
            onClick={() => commit(value + step)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {max !== null && (
        <>
          <input
            type="range"
            aria-label="Aylık kredi miktarı"
            className="w-full accent-primary"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => commit(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </>
      )}
    </div>
  );
}

interface PlanQuoteSummaryProps {
  quote: PlanQuote | null;
  loading: boolean;
  error: string | null;
  className?: string;
}

/** Unit price and monthly total for the chosen amount, as the server quoted. */
export function PlanQuoteSummary({
  quote,
  loading,
  error,
  className,
}: PlanQuoteSummaryProps) {
  return (
    <div className={cn("min-h-[3.5rem] space-y-1", className)}>
      {error ? (
        // Out-of-range / off-step amounts: the server's own Turkish message.
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : quote ? (
        <>
          <p className="text-sm">
            Aylık toplam{" "}
            <span className="text-xl font-bold">{tl(quote.priceWithKdv)}</span>{" "}
            <span className="text-xs text-muted-foreground">(KDV dahil)</span>
          </p>
          {quote.unitPrice !== null && (
            <p className="text-xs text-muted-foreground">
              Kredi başı {tl(quote.unitPrice)} + KDV
            </p>
          )}
        </>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="sm" />
          Fiyat hesaplanıyor...
        </div>
      ) : null}
    </div>
  );
}
