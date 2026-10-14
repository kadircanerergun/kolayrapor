import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { subscriptionApiService } from "@/services/subscription-api";
import type {
  PendingPlanChange,
  PlanChangeOption,
  SubscriptionProduct,
  SubscriptionVariant,
} from "@/types/subscription";
import { PlanChangeDialog } from "@/components/plan-change-dialog";
import {
  CreditQuantityPicker,
  isDynamicPlan,
  minCreditsOf,
  snapCredits,
  tl,
  usePlanQuote,
} from "@/components/credit-quantity-picker";
import { PendingPlanChangeBanner } from "@/components/pending-plan-change-banner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const DESCRIPTION_COLLAPSED_HEIGHT = 240;

function ProductDescription({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHasOverflow(el.scrollHeight > DESCRIPTION_COLLAPSED_HEIGHT + 1);
  }, [html]);

  return (
    <div className="space-y-1">
      <div
        ref={ref}
        className={cn(
          "product-description text-sm text-muted-foreground overflow-hidden",
          !expanded && "max-h-60",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Daha az göster
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Devamını oku
            </>
          )}
        </button>
      )}
    </div>
  );
}
import { cn } from "@/utils/tailwind";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

/**
 * Price block of a dynamic plan: the plan's own price is only a "starting
 * from" figure, the real one is quoted by the server for the chosen amount.
 */
function DynamicPlanPrice({
  variant,
  quantity,
  onQuantityChange,
}: {
  variant: SubscriptionVariant;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const { quote, loading, error } = usePlanQuote(variant.id, quantity);
  const credits = quote?.includedCreditAmount ?? quantity;
  // Yearly: charged once a year (10 × monthly), credits still load monthly.
  const isYearly = variant.billingCycle === "yearly";

  return (
    <div className="space-y-5">
      <CreditQuantityPicker
        plan={variant}
        value={quantity}
        onChange={onQuantityChange}
      />

      <div className="rounded-xl border border-[#7367F0]/20 bg-background p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isYearly ? "Yıllık toplam" : "Aylık toplam"}
        </p>
        <div className="mt-1 flex min-h-[2.75rem] items-center">
          {error ? (
            // Out-of-range / off-step amounts: the server's own Turkish message.
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : quote ? (
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight tabular-nums text-[#7367F0]">
                {tl(quote.price)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                + KDV
              </span>
            </p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" />
              Fiyat hesaplanıyor...
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="gap-1 border-transparent bg-[#7367F0]/10 font-medium text-[#7367F0]"
          >
            <Coins className="h-3 w-3" />
            Her ay {credits.toLocaleString("tr-TR")} kredi
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ₺{variant.price}'den başlayan fiyatlarla ·{" "}
        {isYearly ? "yıllık yenilenir" : "aylık yenilenir"}
      </p>
    </div>
  );
}

export function SubscriptionProducts() {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >({});
  const {
    pharmacy,
    isPending,
    currentSubscription,
    isDemoSubscription,
    hasPaidSubscription,
    terms,
  } = useSubscription();
  // A demo licence is deliberately not part of the plan-change ladder: the
  // server marks every plan unavailable for it. Such a user buys a plan the
  // same way a pharmacy with no licence does.
  const currentPlanId = currentSubscription?.planId;
  const navigate = useNavigate();

  // Direction, prorated price and availability per plan — all decided by the
  // server. Keyed by planId.
  const [planOptions, setPlanOptions] = useState<
    Record<string, PlanChangeOption>
  >({});
  const [pendingChange, setPendingChange] = useState<PendingPlanChange | null>(
    null,
  );
  /** The endpoint is missing or unreachable — fall back to the plain flow. */
  const [optionsUnavailable, setOptionsUnavailable] = useState(false);
  const [changeTarget, setChangeTarget] = useState<{
    planId: string;
    creditQuantity?: number;
  } | null>(null);
  // Chosen monthly amount per dynamic plan, keyed by planId.
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  /** The amount the pharmacy currently receives, when on a dynamic plan. */
  const currentCreditQuantity = hasPaidSubscription
    ? (terms?.creditQuantity ?? null)
    : null;

  const quantityFor = (variant: SubscriptionVariant): number => {
    const chosen = quantities[variant.id];
    if (chosen !== undefined) return chosen;
    // The pharmacy's own plan opens on the amount it already has.
    if (variant.id === currentPlanId && currentCreditQuantity !== null) {
      return snapCredits(variant, currentCreditQuantity);
    }
    return minCreditsOf(variant);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!hasPaidSubscription) {
      setPlanOptions({});
      setPendingChange(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await subscriptionApiService.getChangePlanOptions();
        if (cancelled) return;
        setPlanOptions(
          Object.fromEntries(data.options.map((o) => [o.planId, o])),
        );
        setPendingChange(data.pendingChange);
        setOptionsUnavailable(false);
      } catch {
        // Older server without the change-plan endpoints: keep the cards
        // usable instead of blocking every plan.
        if (!cancelled) setOptionsUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPaidSubscription, currentPlanId, changeTarget]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await subscriptionApiService.getProducts();
      setProducts(data);

      // Set default variant (popular or first) for each product
      const defaults: Record<string, string> = {};
      data.forEach((product) => {
        const popularVariant = product.variants.find((v) => v.isPopular);
        defaults[product.id] = popularVariant?.id || product.variants[0]?.id;
      });
      setSelectedVariants(defaults);
    } catch {
      toast.error("Lisans planları yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeClick = (productId: string) => {
    const variantId = selectedVariants[productId];
    if (!variantId) return;
    const variant = products
      .find((p) => p.id === productId)
      ?.variants.find((v) => v.id === variantId);
    const creditQuantity =
      variant && isDynamicPlan(variant) ? quantityFor(variant) : undefined;

    if (!pharmacy || isPending) {
      toast.info("Satın alabilmek için öncelikle kaydolmalısınız.");
      navigate({ to: "/kayit" });
      return;
    }

    // Staying on the same dynamic plan with another amount is a plan change
    // too — the server works out whether it is a raise or a reduction.
    const isPlanChange =
      hasPaidSubscription &&
      (currentSubscription?.planId !== variantId ||
        creditQuantity !== undefined);

    // Changing an existing licence is never a plain purchase: the amount is
    // prorated, a downgrade takes no payment at all, and both need confirming
    // against a freshly calculated offer.
    if (isPlanChange && !optionsUnavailable) {
      setChangeTarget({ planId: variantId, creditQuantity });
      return;
    }

    navigate({
      to: "/odeme",
      search: {
        type: isPlanChange ? "plan-change" : "subscription",
        id: variantId,
        qty: creditQuantity,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingChange && (
        <PendingPlanChangeBanner
          pendingChange={pendingChange}
          onCancelled={() => setPendingChange(null)}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const selectedVariantId = selectedVariants[product.id];
        const selectedVariant = product.variants.find(
          (v) => v.id === selectedVariantId,
        );
        // What the server says about switching to this exact plan.
        const changeOption = selectedVariantId
          ? planOptions[selectedVariantId]
          : undefined;
        const isCurrentPlan =
          hasPaidSubscription && currentPlanId === selectedVariantId;
        const isDynamic = isDynamicPlan(selectedVariant);
        const selectedQuantity =
          selectedVariant && isDynamic ? quantityFor(selectedVariant) : null;
        // The pharmacy's own dynamic plan stays selectable: the amount can be
        // raised or lowered without leaving the plan.
        const isCurrentDynamic = isCurrentPlan && isDynamic;
        const isSameQuantity =
          isCurrentDynamic &&
          currentCreditQuantity !== null &&
          selectedQuantity === currentCreditQuantity;
        const isPendingTarget =
          !!selectedVariantId &&
          pendingChange?.planId === selectedVariantId &&
          // A scheduled change of amount on the current plan is shown by the
          // banner; the card keeps offering the picker.
          !isCurrentDynamic;
        const blockedReason =
          changeOption && !changeOption.available && !isCurrentDynamic
            ? (changeOption.reason ?? "Bu plana şu anda geçemezsiniz.")
            : null;
        const changeLabel =
          changeOption?.direction === "upgrade"
            ? "Planı Yükselt"
            : changeOption?.direction === "downgrade"
              ? "Bu Plana Geç"
              : "Planı Değiştir";

        const selectVariant = (variant: SubscriptionVariant) => {
          // Keep the chosen amount when switching monthly ↔ yearly.
          if (
            selectedVariant &&
            isDynamic &&
            isDynamicPlan(variant) &&
            quantities[variant.id] === undefined
          ) {
            const carried = snapCredits(variant, quantityFor(selectedVariant));
            setQuantities((prev) => ({ ...prev, [variant.id]: carried }));
          }
          setSelectedVariants((prev) => ({
            ...prev,
            [product.id]: variant.id,
          }));
        };

        const variantGrid = (
          <div className="grid grid-cols-2 gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => selectVariant(variant)}
                className={cn(
                  "relative rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                  selectedVariantId === variant.id
                    ? "border-primary bg-primary/5"
                    : "border-muted",
                )}
              >
                {variant.isPopular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge
                      variant="secondary"
                      className="text-xs px-2 py-0"
                    >
                      Popüler
                    </Badge>
                  </div>
                )}
                <div className="text-xs font-medium">
                  {variant.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {variant.duration}
                </div>
              </button>
            ))}
          </div>
        );

        const priceBlock = (
          <>
            {selectedVariant && isDynamic && selectedQuantity !== null && (
              <DynamicPlanPrice
                key={selectedVariant.id}
                variant={selectedVariant}
                quantity={selectedQuantity}
                onQuantityChange={(quantity) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [selectedVariant.id]: quantity,
                  }))
                }
              />
            )}

            {/* Price — at the bottom, fixed height across cards */}
            {selectedVariant && !isDynamic && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    ₺{selectedVariant.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    + KDV
                  </span>
                  {selectedVariant.originalPrice ? (
                    <span className="text-lg text-muted-foreground line-through">
                      ₺{selectedVariant.originalPrice}
                    </span>
                  ) : null}
                </div>
                <div className="h-5">
                  {selectedVariant.discount ? (
                    <Badge variant="secondary" className="text-xs">
                      %{selectedVariant.discount} İndirim
                    </Badge>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    selectedVariant.includedCreditAmount > 0
                      ? ""
                      : "invisible",
                  )}
                >
                  Aylık {selectedVariant.includedCreditAmount} kredi dahil
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedVariant.duration} boyunca geçerli
                </p>
              </div>
            )}
          </>
        );

        const actions = (
          <>
            {isCurrentDynamic ? (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  onClick={() => handleSubscribeClick(product.id)}
                  disabled={isSameQuantity}
                >
                  Kredi miktarını değiştir
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {currentCreditQuantity !== null
                    ? `Mevcut lisansınız: aylık ${currentCreditQuantity} kredi`
                    : "Mevcut lisansınız"}
                </p>
              </>
            ) : isCurrentPlan ? (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                disabled
              >
                Mevcut Lisansınız Aktif
              </Button>
            ) : isPendingTarget ? (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                disabled
              >
                {new Date(pendingChange!.effectiveAt).toLocaleDateString(
                  "tr-TR",
                )}{" "}
                tarihinde geçilecek
              </Button>
            ) : hasPaidSubscription ? (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  variant={product.isRecommended ? "default" : "outline"}
                  onClick={() => handleSubscribeClick(product.id)}
                  disabled={!!blockedReason}
                >
                  {changeLabel}
                </Button>
                {/* Unavailable plans stay visible with the server's reason
                    rather than disappearing from the list. */}
                {blockedReason ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {blockedReason}
                  </p>
                ) : changeOption?.effect === "period_end" ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Dönem sonunda uygulanır, şimdi ücret alınmaz
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  variant={product.isRecommended ? "default" : "outline"}
                  onClick={() => handleSubscribeClick(product.id)}
                >
                  {isDemoSubscription ? "Lisans Satın Al" : "Lisans Al"}
                </Button>
                {isDemoSubscription && (
                  <p className="text-center text-xs text-muted-foreground">
                    Demo lisansınızın yerine geçer, kalan demo krediniz
                    geçerlilik süresi boyunca korunur.
                  </p>
                )}
              </>
            )}
          </>
        );

        // Dynamic packages get their own full-width row below the others,
        // laid out horizontally: the pitch on the left, the builder on the right.
        if (product.variants.some(isDynamicPlan)) {
          return (
            <Card
              key={product.id}
              className="relative order-last col-span-full overflow-hidden border-[#7367F0]/40 bg-gradient-to-br from-[#7367F0]/10 via-background to-background shadow-md shadow-[#7367F0]/10"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#7367F0]/20 blur-3xl"
              />
              <div className="relative grid md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                <div className="flex flex-col gap-6 p-6 md:p-8">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="gap-1 border-transparent bg-[#7367F0] text-white hover:bg-[#7367F0]/90">
                        <SlidersHorizontal className="h-3 w-3" />
                        Esnek fiyatlandırma
                      </Badge>
                      {product.isRecommended && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Önerilen
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight">
                      {product.name}
                    </h3>
                    <p className="max-w-prose text-muted-foreground">
                      İhtiyacınız kadar kredi seçin, fazlasına ödeme yapmayın.
                      Fiyat seçtiğiniz miktara göre anında hesaplanır.
                    </p>
                  </div>
                  {selectedVariant?.description && (
                    <ProductDescription
                      key={selectedVariant.id}
                      html={selectedVariant.description}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-6 border-t border-[#7367F0]/20 bg-[#7367F0]/5 p-6 md:border-l md:border-t-0 md:p-8 [&_input[type=range]]:accent-[#7367F0]">
                  {product.variants.length > 1 && (
                    <div
                      role="radiogroup"
                      aria-label="Ödeme dönemi"
                      className="flex rounded-full border border-[#7367F0]/20 bg-background p-1 shadow-sm"
                    >
                      {[...product.variants]
                        // Monthly first, then yearly.
                        .sort((a, b) =>
                          a.billingCycle === b.billingCycle
                            ? 0
                            : a.billingCycle === "monthly"
                              ? -1
                              : 1,
                        )
                        .map((variant) => {
                          const selected = selectedVariantId === variant.id;
                          const isYearlyOption =
                            variant.billingCycle === "yearly";
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => selectVariant(variant)}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                                selected
                                  ? "bg-[#7367F0] text-white shadow-md shadow-[#7367F0]/30"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {isYearlyOption
                                ? "Yıllık"
                                : variant.billingCycle === "monthly"
                                  ? "Aylık"
                                  : variant.name}
                              {isYearlyOption && (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                    selected
                                      ? "bg-white/20 text-white"
                                      : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
                                  )}
                                >
                                  2 ay bedava
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                  {priceBlock}
                  <div className="mt-auto flex flex-col items-stretch gap-2 [&>button:not(:disabled)]:border-transparent [&>button:not(:disabled)]:bg-[#7367F0] [&>button:not(:disabled)]:text-white [&>button:not(:disabled):hover]:bg-[#5f53e6]">
                    {actions}
                  </div>
                </div>
              </div>
            </Card>
          );
        }

        return (
          <Card
            key={product.id}
            className={cn(
              "relative flex flex-col",
              product.isRecommended && "border-primary shadow-lg",
            )}
          >
            {product.isRecommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Önerilen
                </Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-2xl">{product.name}</CardTitle>
              {selectedVariant?.description && (
                <ProductDescription
                  key={selectedVariant.id}
                  html={selectedVariant.description}
                />
              )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col space-y-6">
              {/* Variants — pinned just above the price */}
              {product.variants.length > 0 && (
                <div className="mt-auto space-y-3">
                  <h4 className="text-sm font-semibold">Süre Seçin:</h4>
                  {variantGrid}
                </div>
              )}

              {priceBlock}
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-2">
              {actions}
            </CardFooter>
          </Card>
        );
      })}
      </div>

      <PlanChangeDialog
        planId={changeTarget?.planId ?? null}
        creditQuantity={changeTarget?.creditQuantity}
        open={!!changeTarget}
        onOpenChange={(open) => {
          if (!open) setChangeTarget(null);
        }}
      />
    </div>
  );
}
