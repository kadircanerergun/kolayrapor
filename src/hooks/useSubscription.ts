import { usePharmacy } from "@/contexts/pharmacy-context";
import type { SubscriptionProduct } from "@/types/subscription";

export function useSubscription() {
  const {
    pharmacy,
    isPending,
    ipAddress,
    subscription: currentSubscription,
    pendingChange,
    creditBalance,
    products: availableProducts,
    creditPackages,
    loading,
    error,
    refresh,
  } = usePharmacy();

  const getCurrentProduct = (): SubscriptionProduct | null => {
    if (!currentSubscription) return null;
    return (
      availableProducts.find((p) =>
        p.variants.some((v) => v.id === currentSubscription.planId),
      ) ?? null
    );
  };

  const getCurrentVariant =
    (): SubscriptionProduct["variants"][number] | null => {
      const product = getCurrentProduct();
      if (!product || !currentSubscription) return null;
      return (
        product.variants.find(
          (v) => v.id === currentSubscription.planId,
        ) ?? null
      );
    };

  const currentProduct = getCurrentProduct();
  const currentVariant = getCurrentVariant();

  const isActive = currentSubscription?.status === "active";

  /**
   * The demo licence handed out from the admin panel. It is a real active
   * subscription, but it is not a paid plan: the change-plan endpoints refuse
   * it by design, so buying a plan on top of it is a plain purchase.
   */
  const isDemoSubscription =
    isActive && currentSubscription?.plan?.isDemo === true;

  /** An active, paid plan — the only case where plan change applies. */
  const hasPaidSubscription = isActive && !isDemoSubscription;

  return {
    pharmacy,
    isPending,
    ipAddress,
    currentSubscription,
    isDemoSubscription,
    hasPaidSubscription,
    pendingChange,
    creditBalance,
    currentProduct,
    currentVariant,
    availableProducts,
    creditPackages,
    loading,
    error,
    refresh,
  };
}
