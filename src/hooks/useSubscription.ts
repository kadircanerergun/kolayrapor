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

  return {
    pharmacy,
    isPending,
    ipAddress,
    currentSubscription,
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
